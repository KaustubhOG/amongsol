use super::session::GameSession;

pub fn assign_impostor(session: &mut GameSession) {
    if session.players.is_empty() {
        return;
    }
    let index = rand_index(session.players.len());
    let impostor_id = session.players[index].id.clone();
    session.impostor = Some(impostor_id);
}

fn rand_index(len: usize) -> usize {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .subsec_nanos() as usize;
    nanos % len
}