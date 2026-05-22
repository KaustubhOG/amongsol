use std::sync::Arc;
use tokio::time::{interval, Duration};

use crate::AppState;
use crate::game::session::GameState;
use crate::ws::messages::ServerMessage;
use crate::ws::router::broadcast_to_game;

pub fn start_timer(game_id: String, state: AppState) {
    tokio::spawn(async move {
        let mut tick = interval(Duration::from_secs(1));

        loop {
            tick.tick().await;

            let done = {
                let mut session = match state.game_manager.sessions.get_mut(&game_id) {
                    Some(s) => s,
                    None => break,
                };

                if session.state != GameState::Playing {
                    continue;
                }

                if session.timer_remaining == 0 {
                    session.state = GameState::CodeLocked;
                    true
                } else {
                    session.timer_remaining -= 1;

                    if session.timer_remaining == 30 {
                        session.state = GameState::CodeLocked;
                    }

                    false
                }
            };

            let remaining = {
                state.game_manager
                    .sessions
                    .get(&game_id)
                    .map(|s| s.timer_remaining)
                    .unwrap_or(0)
            };

            broadcast_to_game(
                &game_id,
                ServerMessage::TimerTick { remaining },
                &state,
            )
            .await;

            if done {
                break;
            }
        }
    });
}