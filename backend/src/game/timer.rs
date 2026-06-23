use std::sync::Arc;
use std::sync::atomic::Ordering;

use dashmap::DashMap;
use serde_json::json;
use tokio::time::{sleep, Duration};

use crate::game::manager::GameManager;
use crate::game::session::GameState;
use crate::types::PlayerSender;

pub fn start_timer(
    game_id: String,
    game_manager: Arc<GameManager>,
    connections: Arc<DashMap<String, PlayerSender>>,
) {
    tokio::spawn(async move {
        run_timer(game_id, game_manager, connections).await;
    });
}

async fn run_timer(
    game_id: String,
    game_manager: Arc<GameManager>,
    connections: Arc<DashMap<String, PlayerSender>>,
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
            return;
        }
    }
}

fn broadcast_raw(
    connections: &Arc<DashMap<String, PlayerSender>>,
    conn_ids: &[String],
    msg: &str,
) {
    for conn_id in conn_ids {
        if let Some(sender) = connections.get(conn_id) {
            let _ = sender.send(msg.to_string());
        }
    }
}