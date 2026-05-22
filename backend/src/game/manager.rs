use dashmap::DashMap;
use std::sync::Arc;
use uuid::Uuid;

use super::session::GameSession;

pub struct GameManager {
    pub sessions: DashMap<String, GameSession>,
    pub conn_to_game: DashMap<String, String>,
}

impl GameManager {
    pub fn new() -> Self {
        Self {
            sessions: DashMap::new(),
            conn_to_game: DashMap::new(),
        }
    }

    pub fn create_game(&self, host_wallet: String, conn_id: String) -> String {
        let game_id = Uuid::new_v4()
            .to_string()
            .split('-')
            .next()
            .unwrap()
            .to_uppercase();

        let session = GameSession::new(game_id.clone(), host_wallet, conn_id.clone());
        self.sessions.insert(game_id.clone(), session);
        self.conn_to_game.insert(conn_id, game_id.clone());
        game_id
    }

    pub fn join_game(
        &self,
        game_id: &str,
        wallet: String,
        conn_id: String,
    ) -> Result<(), &'static str> {
        let mut session = self.sessions.get_mut(game_id).ok_or("game not found")?;
        session.add_player(wallet, conn_id.clone())?;
        self.conn_to_game.insert(conn_id, game_id.to_string());
        Ok(())
    }

    pub fn find_game_by_conn(&self, conn_id: &str) -> Option<String> {
        self.conn_to_game.get(conn_id).map(|g| g.clone())
    }

    pub fn remove_conn(&self, conn_id: &str) {
        if let Some((_, game_id)) = self.conn_to_game.remove(conn_id) {
            if let Some(mut session) = self.sessions.get_mut(&game_id) {
                session.players.retain(|p| p.conn_id != conn_id);
            }
        }
    }
}