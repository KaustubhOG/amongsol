use std::collections::HashMap;

use crate::game::challenges::random_challenge;
use crate::game::roles::assign_impostor;
use crate::game::session::{Edit, GameState, WinnerType};
use crate::game::timer::start_timer;
use crate::ws::messages::{ClientMessage, EditInfo, FunctionInfo, PlayerInfo, ServerMessage};
use crate::AppState;

pub async fn handle_client_message(msg: ClientMessage, conn_id: &str, state: &AppState) {
    match msg {
        ClientMessage::JoinGame { game_id, wallet } => {
            handle_join(conn_id, game_id, wallet, state).await
        }
        ClientMessage::StartGame => handle_start_game(conn_id, state).await,
        ClientMessage::EditCode { function_name, code } => {
            handle_edit(conn_id, function_name, code, state).await
        }
        ClientMessage::RunTests => handle_run_tests(conn_id, state).await,
        ClientMessage::CallMeeting => handle_meeting(conn_id, state).await,
        ClientMessage::CastVote { target_wallet } => {
            handle_vote(conn_id, target_wallet, state).await
        }
    }
}

async fn handle_join(conn_id: &str, game_id: String, wallet: String, state: &AppState) {
    match state
        .game_manager
        .join_game(&game_id, wallet, conn_id.to_string())
    {
        Ok((_player, all_players)) => {
            let your_color = all_players
                .iter()
                .find(|p| p.conn_id == conn_id)
                .map(|p| p.cursor_color.clone())
                .unwrap_or_default();

            let player_infos: Vec<PlayerInfo> = all_players
                .iter()
                .map(|p| PlayerInfo {
                    color: p.cursor_color.clone(),
                    is_host: p.is_host,
                })
                .collect();

            send_to_conn(
                conn_id,
                ServerMessage::GameJoined {
                    game_id: game_id.clone(),
                    your_color,
                    players: player_infos.clone(),
                },
                state,
            )
            .await;

            broadcast_to_game(
                &game_id,
                ServerMessage::PlayerJoined {
                    players: player_infos,
                },
                state,
            )
            .await;
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

    let is_host = {
        let session = match state.game_manager.sessions.get(&game_id) {
            Some(s) => s,
            None => return,
        };
        session
            .player_by_conn(conn_id)
            .map(|p| p.is_host)
            .unwrap_or(false)
    };

    if !is_host {
        send_to_conn(
            conn_id,
            ServerMessage::Error {
                message: "only host can start the game".to_string(),
            },
            state,
        )
        .await;
        return;
    }

    let functions = {
        let mut session = match state.game_manager.sessions.get_mut(&game_id) {
            Some(s) => s,
            None => return,
        };

        if session.state != GameState::Lobby {
            return;
        }

        assign_impostor(&mut session);
        session.state = GameState::Playing;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        session.started_at = Some(now);

        let challenge = random_challenge();
        let fns: Vec<FunctionInfo> = challenge
            .functions
            .iter()
            .map(|f| FunctionInfo {
                name: f.name.clone(),
                code: f.code.clone(),
            })
            .collect();

        for f in &challenge.functions {
            session.current_code.insert(f.name.clone(), f.code.clone());
        }

        session.challenge = Some(challenge);
        fns
    };

    broadcast_to_game(&game_id, ServerMessage::GameStarted { functions }, state).await;

    start_timer(
        game_id,
        state.game_manager.clone(),
        state.connections.clone(),
    );
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
            send_to_conn(
                conn_id,
                ServerMessage::Error {
                    message: "cannot edit outside of playing state".to_string(),
                },
                state,
            )
            .await;
            return;
        }

        let color = session
            .player_by_conn(conn_id)
            .map(|p| p.cursor_color.clone())
            .unwrap_or_default();

        session.current_code.insert(function_name.clone(), code);
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

    let (cursor_color, challenge_id, function_name, current_code) = {
        let session = match state.game_manager.sessions.get(&game_id) {
            Some(s) => s,
            None => return,
        };

        if session.state != GameState::Playing && session.state != GameState::CodeLocked {
            return;
        }

        let color = session
            .player_by_conn(conn_id)
            .map(|p| p.cursor_color.clone())
            .unwrap_or_default();

        let (cid, fname) = session
            .challenge
            .as_ref()
            .and_then(|c| c.functions.first().map(|f| (c.id.clone(), f.name.clone())))
            .unwrap_or_else(|| ("transfer".to_string(), "transfer".to_string()));

        let code = session
            .current_code
            .get(&fname)
            .cloned()
            .unwrap_or_default();

        (color, cid, fname, code)
    };

    let results =
        crate::compiler::runner::run_tests(&challenge_id, &function_name, &current_code).await;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    {
        let mut session = match state.game_manager.sessions.get_mut(&game_id) {
            Some(s) => s,
            None => return,
        };

        session.edit_history.push(Edit {
            player_id: conn_id.to_string(),
            cursor_color: cursor_color.clone(),
            function_name: function_name.clone(),
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

        if session.state != GameState::Playing && session.state != GameState::CodeLocked {
            send_to_conn(
                conn_id,
                ServerMessage::Error {
                    message: "cannot call meeting in current state".to_string(),
                },
                state,
            )
            .await;
            return;
        }

        session.state = GameState::Meeting;

        let color = session
            .player_by_conn(conn_id)
            .map(|p| p.cursor_color.clone())
            .unwrap_or_default();

        let history: Vec<EditInfo> = session
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
            .collect();

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

async fn handle_vote(conn_id: &str, target_wallet: String, state: &AppState) {
    let game_id = match state.game_manager.find_game_by_conn(conn_id) {
        Some(id) => id,
        None => return,
    };

    let voter_wallet = {
        let session = match state.game_manager.sessions.get(&game_id) {
            Some(s) => s,
            None => return,
        };

        if session.state != GameState::Meeting && session.state != GameState::Voting {
            send_to_conn(
                conn_id,
                ServerMessage::Error {
                    message: "cannot vote outside of meeting".to_string(),
                },
                state,
            )
            .await;
            return;
        }

        session
            .player_by_conn(conn_id)
            .map(|p| p.wallet.clone())
            .unwrap_or_default()
    };

    let (vote_counts, game_result) = {
        let mut session = match state.game_manager.sessions.get_mut(&game_id) {
            Some(s) => s,
            None => return,
        };

        let result = session.cast_vote(&voter_wallet, &target_wallet);
        let counts: HashMap<String, usize> = session.vote_counts();
        (counts, result)
    };

    broadcast_to_game(
        &game_id,
        ServerMessage::VoteUpdate { votes: vote_counts },
        state,
    )
    .await;

    if let Some(winner_type) = game_result {
        let (winner_str, impostor_color, impostor_wallet, duration) = {
            let session = match state.game_manager.sessions.get(&game_id) {
                Some(s) => s,
                None => return,
            };
            let w = match winner_type {
                WinnerType::Civilians => "civilians",
                WinnerType::Impostor => "impostor",
            }
            .to_string();
            let color = session.impostor_color().unwrap_or_default();
            let wallet = session.impostor_wallet().unwrap_or_default();
            let dur = session.elapsed_secs();
            (w, color, wallet, dur)
        };

        broadcast_to_game(
            &game_id,
            ServerMessage::GameOver {
                winner: winner_str.clone(),
                impostor_color: impostor_color.clone(),
                impostor_wallet: impostor_wallet.clone(),
            },
            state,
        )
        .await;

        let player_count = state
            .game_manager
            .sessions
            .get(&game_id)
            .map(|s| s.players.len() as i32)
            .unwrap_or(0);

        let db = state.db.clone();
        let gid = game_id.clone();
        tokio::spawn(async move {
            let _ = sqlx::query(
                "INSERT INTO game_results (game_id, winner, impostor_wallet, impostor_color, player_count, duration_secs) VALUES ($1, $2, $3, $4, $5, $6)"
            )
            .bind(&gid)
            .bind(&winner_str)
            .bind(&impostor_wallet)
            .bind(&impostor_color)
            .bind(player_count)
            .bind(duration as i64)
            .execute(&*db)
            .await;
        });
    }
}

pub async fn broadcast_to_game(game_id: &str, msg: ServerMessage, state: &AppState) {
    let conn_ids: Vec<String> = match state.game_manager.sessions.get(game_id) {
        Some(session) => session.all_conn_ids(),
        None => return,
    };

    let json = match serde_json::to_string(&msg) {
        Ok(j) => j,
        Err(_) => return,
    };

    for conn_id in conn_ids {
        if let Some(sender) = state.connections.get(&conn_id) {
            let _ = sender.send(json.clone());
        }
    }
}

pub async fn send_to_conn(conn_id: &str, msg: ServerMessage, state: &AppState) {
    if let Some(sender) = state.connections.get(conn_id) {
        if let Ok(json) = serde_json::to_string(&msg) {
            let _ = sender.send(json);
        }
    }
}