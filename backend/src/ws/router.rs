use futures_util::SinkExt;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::game::roles::assign_impostor;
use crate::game::session::{Edit, GameState, TestResult};
use crate::game::timer::start_timer;
use crate::ws::messages::{ClientMessage, EditInfo, FunctionInfo, PlayerInfo, ServerMessage};
use crate::AppState;

pub async fn handle_client_message(msg: ClientMessage, conn_id: &str, state: &AppState) {
    match msg {
        ClientMessage::StartGame => handle_start_game(conn_id, state).await,
        ClientMessage::EditCode {
            function_name,
            code,
        } => handle_edit(conn_id, function_name, code, state).await,
        ClientMessage::RunTests => handle_run_tests(conn_id, state).await,
        ClientMessage::CallMeeting => handle_meeting(conn_id, state).await,
        ClientMessage::CastVote { target_id } => handle_vote(conn_id, target_id, state).await,
        ClientMessage::JoinGame { game_id, wallet } => {
            handle_join(conn_id, game_id, wallet, state).await
        }
    }
}

async fn handle_join(conn_id: &str, game_id: String, wallet: String, state: &AppState) {
    match state
        .game_manager
        .join_game(&game_id, wallet.clone(), conn_id.to_string())
    {
        Ok(_) => {
            let (your_color, players) = {
                let session = state.game_manager.sessions.get(&game_id).unwrap();
                let color = session
                    .get_player_by_conn(conn_id)
                    .map(|p| p.cursor_color.clone())
                    .unwrap_or_default();
                let players = session
                    .players
                    .iter()
                    .map(|p| PlayerInfo {
                        color: p.cursor_color.clone(),
                        is_host: p.is_host,
                    })
                    .collect::<Vec<_>>();
                (color, players)
            };

            send_to_conn(
                conn_id,
                ServerMessage::GameJoined {
                    game_id: game_id.clone(),
                    your_color,
                    players: players.clone(),
                },
                state,
            )
            .await;

            broadcast_to_game(&game_id, ServerMessage::PlayerJoined { players }, state).await;
        }
        Err(e) => {
            send_to_conn(
                conn_id,
                ServerMessage::Error {
                    message: e.to_string(),
                },
                state,
            )
            .await;
        }
    }
}

async fn handle_start_game(conn_id: &str, state: &AppState) {
    let game_id = match state.game_manager.find_game_by_conn(conn_id) {
        Some(id) => id,
        None => return,
    };

    let functions = {
        let mut session = match state.game_manager.sessions.get_mut(&game_id) {
            Some(s) => s,
            None => return,
        };

        assign_impostor(&mut session);
        session.state = GameState::Playing;

        let challenge = default_challenge();
        let fns = challenge
            .functions
            .iter()
            .map(|f| FunctionInfo {
                name: f.name.clone(),
                code: f.broken_code.clone(),
            })
            .collect::<Vec<_>>();

        for f in &challenge.functions {
            session
                .current_code
                .insert(f.name.clone(), f.broken_code.clone());
        }

        session.challenge = Some(challenge);
        fns
    };

    broadcast_to_game(&game_id, ServerMessage::GameStarted { functions }, state).await;
    start_timer(game_id, state.clone());
}

async fn handle_edit(conn_id: &str, function_name: String, code: String, state: &AppState) {
    let game_id = match state.game_manager.find_game_by_conn(conn_id) {
        Some(id) => id,
        None => return,
    };

    let cursor_color = {
        let mut session = match state.game_manager.sessions.get_mut(&game_id) {
            Some(s) => s,
            None => return,
        };

        if session.state != GameState::Playing {
            return;
        }

        let color = session
            .get_player_by_conn(conn_id)
            .map(|p| p.cursor_color.clone())
            .unwrap_or_default();

        session
            .current_code
            .insert(function_name.clone(), code.clone());
        color
    };

    broadcast_to_game(
        &game_id,
        ServerMessage::PlayerEditing {
            function_name,
            cursor_color,
        },
        state,
    )
    .await;
}

async fn handle_run_tests(conn_id: &str, state: &AppState) {
    let game_id = match state.game_manager.find_game_by_conn(conn_id) {
        Some(id) => id,
        None => return,
    };

    let (cursor_color, current_code) = {
        let session = match state.game_manager.sessions.get(&game_id) {
            Some(s) => s,
            None => return,
        };

        let color = session
            .get_player_by_conn(conn_id)
            .map(|p| p.cursor_color.clone())
            .unwrap_or_default();

        let code = session
            .current_code
            .get("transfer")
            .cloned()
            .unwrap_or_default();
        (color, code)
    };

    let results = crate::compiler::runner::run_tests("transfer", "transfer", &current_code).await;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    {
        let mut session = match state.game_manager.sessions.get_mut(&game_id) {
            Some(s) => s,
            None => return,
        };

        session.edit_history.push(crate::game::session::Edit {
            player_id: conn_id.to_string(),
            cursor_color: cursor_color.clone(),
            function_name: "transfer".to_string(),
            timestamp,
            test_snapshot: results.clone(),
        });
    }

    broadcast_to_game(
        &game_id,
        ServerMessage::TestResults {
            results,
            triggered_by_color: cursor_color,
        },
        state,
    )
    .await;
}

async fn handle_meeting(conn_id: &str, state: &AppState) {
    let game_id = match state.game_manager.find_game_by_conn(conn_id) {
        Some(id) => id,
        None => return,
    };

    let (caller_color, edit_history) = {
        let mut session = match state.game_manager.sessions.get_mut(&game_id) {
            Some(s) => s,
            None => return,
        };

        if session.state != GameState::Playing {
            return;
        }

        session.state = GameState::Meeting;

        let color = session
            .get_player_by_conn(conn_id)
            .map(|p| p.cursor_color.clone())
            .unwrap_or_default();

        let history = session
            .edit_history
            .iter()
            .map(|e| EditInfo {
                cursor_color: e.cursor_color.clone(),
                function_name: e.function_name.clone(),
                timestamp: e.timestamp,
                result: if e.test_snapshot.iter().all(|t| t.passed) {
                    "pass".to_string()
                } else {
                    "fail".to_string()
                },
            })
            .collect::<Vec<_>>();

        (color, history)
    };

    broadcast_to_game(
        &game_id,
        ServerMessage::MeetingCalled {
            edit_history,
            caller_color,
        },
        state,
    )
    .await;
}

async fn handle_vote(conn_id: &str, target_id: String, state: &AppState) {
    let game_id = match state.game_manager.find_game_by_conn(conn_id) {
        Some(id) => id,
        None => return,
    };

    let (vote_counts, game_over, winner, impostor_color, impostor_wallet) = {
        let mut session = match state.game_manager.sessions.get_mut(&game_id) {
            Some(s) => s,
            None => return,
        };

        session.votes.insert(conn_id.to_string(), target_id.clone());

        let mut counts: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
        for v in session.votes.values() {
            *counts.entry(v.clone()).or_insert(0) += 1;
        }

        let player_count = session.players.len() as u32;
        let ejected = counts
            .iter()
            .find(|(_, &v)| v > player_count / 2)
            .map(|(k, _)| k.clone());

        if let Some(ejected_id) = ejected {
            let impostor_id = session.impostor.clone().unwrap_or_default();
            let was_impostor = ejected_id == impostor_id;

            let impostor_player = session.players.iter().find(|p| p.id == impostor_id);
            let color = impostor_player
                .map(|p| p.cursor_color.clone())
                .unwrap_or_default();
            let wallet = impostor_player
                .map(|p| p.wallet.clone())
                .unwrap_or_default();

            session.state = GameState::Ended;

            let winner = if was_impostor {
                "civilians"
            } else {
                "impostor"
            }
            .to_string();
            (counts, true, winner, color, wallet)
        } else {
            (counts, false, String::new(), String::new(), String::new())
        }
    };

    broadcast_to_game(
        &game_id,
        ServerMessage::VoteUpdate { votes: vote_counts },
        state,
    )
    .await;

    if game_over {
        broadcast_to_game(
            &game_id,
            ServerMessage::GameOver {
                winner,
                impostor_color,
                impostor_wallet,
            },
            state,
        )
        .await;
    }
}

fn run_mock_tests(current_code: &std::collections::HashMap<String, String>) -> Vec<TestResult> {
    let transfer_code = current_code.get("transfer").cloned().unwrap_or_default();

    let sender_decreases = transfer_code.contains("sender.balance -= amount");
    let receiver_increases = transfer_code.contains("receiver.balance += amount");

    vec![
        TestResult {
            name: "sender_decreases".to_string(),
            passed: sender_decreases,
        },
        TestResult {
            name: "receiver_increases".to_string(),
            passed: receiver_increases,
        },
        TestResult {
            name: "supply_unchanged".to_string(),
            passed: sender_decreases && receiver_increases,
        },
    ]
}

pub async fn broadcast_to_game(game_id: &str, msg: ServerMessage, state: &AppState) {
    let conn_ids: Vec<String> = {
        match state.game_manager.sessions.get(game_id) {
            Some(session) => session.players.iter().map(|p| p.conn_id.clone()).collect(),
            None => return,
        }
    };

    let json = serde_json::to_string(&msg).unwrap();

    for conn_id in conn_ids {
        if let Some(sender) = state.connections.get(&conn_id) {
            let mut locked = sender.lock().await;
            locked
                .send(axum::extract::ws::Message::Text(json.clone().into()))
                .await
                .ok();
        }
    }
}

pub async fn send_to_conn(conn_id: &str, msg: ServerMessage, state: &AppState) {
    if let Some(sender) = state.connections.get(conn_id) {
        let json = serde_json::to_string(&msg).unwrap();
        let mut locked = sender.lock().await;
        locked
            .send(axum::extract::ws::Message::Text(json.into()))
            .await
            .ok();
    }
}

fn default_challenge() -> crate::game::session::Challenge {
    crate::game::session::Challenge {
        id: "transfer_001".to_string(),
        functions: vec![
            crate::game::session::ChallengeFunction {
                name: "transfer".to_string(),
                broken_code: "pub fn transfer(ctx: Context<Transfer>, amount: u64) -> Result<()> {\n    let sender = &mut ctx.accounts.sender;\n    let receiver = &mut ctx.accounts.receiver;\n\n    sender.balance += amount;\n    receiver.balance -= amount;\n\n    Ok(())\n}".to_string(),
            },
            crate::game::session::ChallengeFunction {
                name: "withdraw".to_string(),
                broken_code: "pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {\n    let vault = &mut ctx.accounts.vault;\n    let user = &mut ctx.accounts.user;\n\n    vault.balance += amount;\n    user.balance -= amount;\n\n    Ok(())\n}".to_string(),
            },
            crate::game::session::ChallengeFunction {
                name: "initialize".to_string(),
                broken_code: "pub fn initialize(ctx: Context<Initialize>) -> Result<()> {\n    let vault = &mut ctx.accounts.vault;\n    vault.owner = ctx.accounts.payer.key();\n    vault.balance = 1000;\n    Ok(())\n}".to_string(),
            },
        ],
        test_file: String::new(),
    }
}
