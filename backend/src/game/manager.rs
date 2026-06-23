use dashmap::DashMap;
use uuid::Uuid;

use crate::errors::AppError;
use crate::game::session::{GameSession, Player};

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

    pub fn create_game(&self) -> String {
        let id = Uuid::new_v4()
            .to_string()
            .split('-')
            .next()
            .unwrap_or("UNKNOWN")
            .to_uppercase();
        self.sessions
            .insert(id.clone(), GameSession::new(id.clone()));
        id
    }

    pub fn join_game(
        &self,
        game_id: &str,
        wallet: String,
        conn_id: String,
    ) -> Result<(Player, Vec<Player>), AppError> {
        let mut session = self
            .sessions
            .get_mut(game_id)
            .ok_or(AppError::GameNotFound)?;

        if let Some(player) = session.try_reconnect(&wallet, conn_id.clone()) {
            self.conn_to_game.insert(conn_id, game_id.to_string());
            let players = session.players.clone();
            return Ok((player, players));
        }

        let player = session.add_player(wallet, conn_id.clone()).map_err(|e| {
            if e.contains("full") {
                AppError::GameFull
            } else if e.contains("started") {
                AppError::GameAlreadyStarted
            } else {
                AppError::Internal(e)
            }
        })?;

        self.conn_to_game.insert(conn_id, game_id.to_string());
        let players = session.players.clone();
        Ok((player, players))
    }

    pub fn remove_conn(&self, conn_id: &str) -> Option<(String, Player, Vec<Player>)> {
        let (_, game_id) = self.conn_to_game.remove(conn_id)?;
        let mut session = self.sessions.get_mut(&game_id)?;
        let removed = session.remove_player_by_conn(conn_id)?;
        let remaining = session.players.clone();
        Some((game_id, removed, remaining))
    }

    pub fn find_game_by_conn(&self, conn_id: &str) -> Option<String> {
        self.conn_to_game.get(conn_id).map(|r| r.value().clone())
    }
}
