use std::sync::atomic::Ordering;
use std::sync::Arc;

use dashmap::DashMap;
use serde_json::json;
use sqlx::PgPool;
use tokio::time::{sleep, Duration};

use crate::compiler::runner::run_tests;
use crate::game::manager::GameManager;
use crate::game::session::{GameState, WinnerType};
use crate::types::PlayerSender;
use crate::ws::router::finish_game;
use crate::AppState;

pub fn start_timer(
    game_id: String,
    game_manager: Arc<GameManager>,
    connections: Arc<DashMap<String, PlayerSender>>,
    db: Arc<PgPool>,
) {
    tokio::spawn(async move {
        run_timer(game_id, game_manager, connections, db).await;
    });
}

async fn run_timer(
    game_id: String,
    game_manager: Arc<GameManager>,
    connections: Arc<DashMap<String, PlayerSender>>,
    db: Arc<PgPool>,
) {
    loop {
        sleep(Duration::from_secs(1)).await;

        let (remaining, conn_ids, just_locked, stopped) = {
            let mut session = match game_manager.sessions.get_mut(&game_id) {
                Some(s) => s,
                None => return,
            };

            if session.timer_stopped.load(Ordering::SeqCst) || session.state == GameState::Ended {
                return;
            }

            if session.timer_remaining > 0 {
                session.timer_remaining -= 1;
            }

            let remaining = session.timer_remaining;
            let conn_ids = session.all_conn_ids();
            let stopped = session.timer_stopped.load(Ordering::SeqCst);

            let just_locked = remaining == 30 && session.state == GameState::Playing;
            if just_locked {
                session.state = GameState::CodeLocked;
            }

            (remaining, conn_ids, just_locked, stopped)
        };

        if stopped {
            return;
        }

        let tick = json!({ "type": "TimerTick", "remaining": remaining }).to_string();
        broadcast_raw(&connections, &conn_ids, &tick);

        if just_locked {
            let locked = json!({ "type": "CodeLocked" }).to_string();
            broadcast_raw(&connections, &conn_ids, &locked);
        }

        if remaining == 0 {
            let (challenge_id, function_name, current_code) = {
                let session = match game_manager.sessions.get(&game_id) {
                    Some(s) => s,
                    None => return,
                };

                let (challenge_id, function_name) = session
                    .challenge
                    .as_ref()
                    .and_then(|challenge| {
                        challenge
                            .functions
                            .first()
                            .map(|function| (challenge.id.clone(), function.name.clone()))
                    })
                    .unwrap_or_else(|| ("transfer".to_string(), "transfer".to_string()));

                let current_code = session
                    .current_code
                    .get(&function_name)
                    .cloned()
                    .unwrap_or_default();

                (challenge_id, function_name, current_code)
            };

            let results = run_tests(&challenge_id, &function_name, &current_code).await;
            let winner = if results.iter().all(|result| result.passed) {
                WinnerType::Civilians
            } else {
                WinnerType::Impostor
            };

            if let Some(mut session) = game_manager.sessions.get_mut(&game_id) {
                session.latest_test_results = results.clone();
            }

            let results_msg = json!({
                "type": "TestResults",
                "results": results,
                "triggered_by_color": "system"
            })
            .to_string();
            broadcast_raw(&connections, &conn_ids, &results_msg);

            let state = AppState {
                game_manager,
                connections,
                db,
            };
            finish_game(&game_id, winner, &state).await;
            return;
        }
    }
}

fn broadcast_raw(connections: &Arc<DashMap<String, PlayerSender>>, conn_ids: &[String], msg: &str) {
    for conn_id in conn_ids {
        if let Some(sender) = connections.get(conn_id) {
            let _ = sender.send(msg.to_string());
        }
    }
}
