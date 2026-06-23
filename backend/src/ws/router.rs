use std::collections::HashMap;
use std::sync::atomic::Ordering;

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
        ClientMessage::EditCode {
            function_name,
            code,
        } => handle_edit(conn_id, function_name, code, state).await,
        ClientMessage::RunTests => handle_run_tests(conn_id, state).await,
        ClientMessage::CallMeeting => handle_meeting(conn_id, state).await,
        ClientMessage::StartVoting => handle_start_voting(conn_id, state).await,
        ClientMessage::CastVote { target_wallet } => {
            handle_vote(conn_id, target_wallet, state).await
        }
    }
}

async fn handle_join(conn_id: &str, game_id: String, wallet: String, state: &AppState) {
    match state
        .game_manager
        .join_game(&game_id, wallet.clone(), conn_id.to_string())
    {
        Ok((_player, all_players)) => {
            let (
                state_name,
                role_message,
                game_started,
                latest_results,
                timer_remaining,
                is_locked,
                meeting_called,
                vote_update,
                game_over,
            ) = {
                let session = match state.game_manager.sessions.get(&game_id) {
                    Some(s) => s,
                    None => return,
                };

                let state_name = state_label(session.state.clone()).to_string();
                let role_message =
                    (session.state != GameState::Lobby).then(|| ServerMessage::RoleAssigned {
                        role: role_for_wallet(&session, &wallet),
                    });
                let game_started =
                    session
                        .challenge
                        .as_ref()
                        .map(|challenge| ServerMessage::GameStarted {
                            functions: challenge
                                .functions
                                .iter()
                                .map(|f| FunctionInfo {
                                    name: f.name.clone(),
                                    code: session
                                        .current_code
                                        .get(&f.name)
                                        .cloned()
                                        .unwrap_or_else(|| f.code.clone()),
                                })
                                .collect(),
                        });
                let latest_results =
                    (!session.latest_test_results.is_empty()).then(|| ServerMessage::TestResults {
                        results: session.latest_test_results.clone(),
                        triggered_by_color: session
                            .edit_history
                            .last()
                            .map(|edit| edit.cursor_color.clone())
                            .unwrap_or_default(),
                    });
                let is_locked = matches!(
                    session.state,
                    GameState::CodeLocked
                        | GameState::Meeting
                        | GameState::Voting
                        | GameState::Ended
                );
                let meeting_called = matches!(
                    session.state,
                    GameState::Meeting | GameState::Voting | GameState::Ended
                )
                .then(|| ServerMessage::MeetingCalled {
                    edit_history: build_edit_history(&session),
                    caller_color: session.meeting_caller_color.clone().unwrap_or_default(),
                });
                let vote_update = matches!(session.state, GameState::Voting | GameState::Ended)
                    .then(|| ServerMessage::VoteUpdate {
                        votes: session.vote_counts(),
                    });
                let game_over =
                    (session.state == GameState::Ended).then(|| ServerMessage::GameOver {
                        winner: winner_label(
                            session.winner.clone().unwrap_or(WinnerType::Impostor),
                        )
                        .to_string(),
                        impostor_color: session.impostor_color().unwrap_or_default(),
                        impostor_wallet: session.impostor_wallet().unwrap_or_default(),
                    });

                (
                    state_name,
                    role_message,
                    game_started,
                    latest_results,
                    session.timer_remaining,
                    is_locked,
                    meeting_called,
                    vote_update,
                    game_over,
                )
            };

            let your_color = all_players
                .iter()
                .find(|p| p.conn_id == conn_id)
                .map(|p| p.cursor_color.clone())
                .unwrap_or_default();

            let player_infos: Vec<PlayerInfo> = all_players
                .iter()
                .map(|p| PlayerInfo {
                    color: p.cursor_color.clone(),
                    wallet: p.wallet.clone(),
                    is_host: p.is_host,
                })
                .collect();

            send_to_conn(
                conn_id,
                ServerMessage::GameJoined {
                    game_id: game_id.clone(),
                    your_color,
                    players: player_infos.clone(),
                    state: state_name,
                },
                state,
            )
            .await;

            if let Some(msg) = role_message {
                send_to_conn(conn_id, msg, state).await;
            }

            if let Some(msg) = game_started {
                send_to_conn(conn_id, msg, state).await;
            }

            if timer_remaining > 0 {
                send_to_conn(
                    conn_id,
                    ServerMessage::TimerTick {
                        remaining: timer_remaining,
                    },
                    state,
                )
                .await;
            }

            if let Some(msg) = latest_results {
                send_to_conn(conn_id, msg, state).await;
            }

            if is_locked {
                send_to_conn(conn_id, ServerMessage::CodeLocked, state).await;
            }

            if let Some(msg) = meeting_called {
                send_to_conn(conn_id, msg, state).await;
            }

            if vote_update.is_some() {
                send_to_conn(conn_id, ServerMessage::VotingStarted, state).await;
            }

            if let Some(msg) = vote_update {
                send_to_conn(conn_id, msg, state).await;
            }

            if let Some(msg) = game_over {
                send_to_conn(conn_id, msg, state).await;
            }

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
    broadcast_roles(&game_id, state).await;

    start_timer(
        game_id,
        state.game_manager.clone(),
        state.connections.clone(),
        state.db.clone(),
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
        session.latest_test_results = results.clone();
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

        session.timer_stopped.store(true, Ordering::SeqCst);
        session.meeting_caller_color = Some(color.clone());

        (color, build_edit_history(&session))
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

async fn handle_start_voting(conn_id: &str, state: &AppState) {
    let game_id = match state.game_manager.find_game_by_conn(conn_id) {
        Some(id) => id,
        None => return,
    };

    let vote_counts = {
        let mut session = match state.game_manager.sessions.get_mut(&game_id) {
            Some(s) => s,
            None => return,
        };

        if session.state != GameState::Meeting && session.state != GameState::Voting {
            send_to_conn(
                conn_id,
                ServerMessage::Error {
                    message: "cannot start voting in current state".to_string(),
                },
                state,
            )
            .await;
            return;
        }

        session.state = GameState::Voting;
        session.vote_counts()
    };

    broadcast_to_game(&game_id, ServerMessage::VotingStarted, state).await;
    broadcast_to_game(
        &game_id,
        ServerMessage::VoteUpdate { votes: vote_counts },
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

        if session.state == GameState::Meeting {
            session.state = GameState::Voting;
        }

        let result = session.cast_vote(&voter_wallet, &target_wallet);
        let counts: HashMap<String, usize> = session.vote_counts();
        (counts, result)
    };

    broadcast_to_game(&game_id, ServerMessage::VotingStarted, state).await;
    broadcast_to_game(
        &game_id,
        ServerMessage::VoteUpdate { votes: vote_counts },
        state,
    )
    .await;

    if let Some(winner_type) = game_result {
        finish_game(&game_id, winner_type, state).await;
    }
}

fn build_edit_history(session: &crate::game::session::GameSession) -> Vec<EditInfo> {
    session
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
        .collect()
}

fn role_for_wallet(session: &crate::game::session::GameSession, wallet: &str) -> String {
    if session
        .impostor
        .as_deref()
        .map(|impostor| impostor == wallet)
        .unwrap_or(false)
    {
        "impostor".to_string()
    } else {
        "engineer".to_string()
    }
}

fn state_label(state: GameState) -> &'static str {
    match state {
        GameState::Lobby => "lobby",
        GameState::Playing => "playing",
        GameState::CodeLocked => "code_locked",
        GameState::Meeting => "meeting",
        GameState::Voting => "voting",
        GameState::Ended => "ended",
    }
}

fn winner_label(winner: WinnerType) -> &'static str {
    match winner {
        WinnerType::Civilians => "civilians",
        WinnerType::Impostor => "impostor",
    }
}

async fn broadcast_roles(game_id: &str, state: &AppState) {
    let players = match state.game_manager.sessions.get(game_id) {
        Some(session) => session
            .players
            .iter()
            .map(|player| (player.conn_id.clone(), player.wallet.clone()))
            .collect::<Vec<_>>(),
        None => return,
    };

    for (conn_id, wallet) in players {
        let role = match state.game_manager.sessions.get(game_id) {
            Some(session) => role_for_wallet(&session, &wallet),
            None => return,
        };

        send_to_conn(&conn_id, ServerMessage::RoleAssigned { role }, state).await;
    }
}

pub async fn finish_game(game_id: &str, winner_type: WinnerType, state: &AppState) {
    let (winner_str, impostor_color, impostor_wallet, duration, player_count) = {
        let mut session = match state.game_manager.sessions.get_mut(game_id) {
            Some(s) => s,
            None => return,
        };

        session.state = GameState::Ended;
        session.winner = Some(winner_type.clone());
        session.timer_stopped.store(true, Ordering::SeqCst);

        (
            winner_label(winner_type).to_string(),
            session.impostor_color().unwrap_or_default(),
            session.impostor_wallet().unwrap_or_default(),
            session.elapsed_secs(),
            session.players.len() as i32,
        )
    };

    broadcast_to_game(
        game_id,
        ServerMessage::GameOver {
            winner: winner_str.clone(),
            impostor_color: impostor_color.clone(),
            impostor_wallet: impostor_wallet.clone(),
        },
        state,
    )
    .await;

    let db = state.db.clone();
    let gid = game_id.to_string();
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
