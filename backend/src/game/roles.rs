use rand::Rng;

use crate::game::session::GameSession;

pub fn assign_impostor(session: &mut GameSession) {
    if session.players.is_empty() {
        return;
    }
    let idx = rand::thread_rng().gen_range(0..session.players.len());
    session.impostor = Some(session.players[idx].wallet.clone());
}