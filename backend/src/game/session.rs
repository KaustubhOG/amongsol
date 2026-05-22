use std::collections::HashMap;
use serde::{Deserialize, Serialize};

pub type PlayerId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub id: PlayerId,
    pub wallet: String,
    pub cursor_color: String,
    pub is_host: bool,
    pub conn_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edit {
    pub player_id: PlayerId,
    pub cursor_color: String,
    pub function_name: String,
    pub timestamp: u64,
    pub test_snapshot: Vec<TestResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub name: String,
    pub passed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Challenge {
    pub id: String,
    pub functions: Vec<ChallengeFunction>,
    pub test_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChallengeFunction {
    pub name: String,
    pub broken_code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum GameState {
    Lobby,
    Playing,
    CodeLocked,
    Meeting,
    Voting,
    Ended,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WinnerType {
    Civilians,
    Impostor,
}

#[derive(Debug, Clone)]
pub struct GameSession {
    pub id: String,
    pub players: Vec<Player>,
    pub impostor: Option<PlayerId>,
    pub challenge: Option<Challenge>,
    pub edit_history: Vec<Edit>,
    pub state: GameState,
    pub timer_remaining: u64,
    pub votes: HashMap<PlayerId, PlayerId>,
    pub winner: Option<WinnerType>,
    pub current_code: HashMap<String, String>,
}

impl GameSession {
    pub fn new(id: String, host_wallet: String, host_conn_id: String) -> Self {
        let host = Player {
            id: host_wallet.clone(),
            wallet: host_wallet,
            cursor_color: "green".to_string(),
            is_host: true,
            conn_id: host_conn_id,
        };

        Self {
            id,
            players: vec![host],
            impostor: None,
            challenge: None,
            edit_history: Vec::new(),
            state: GameState::Lobby,
            timer_remaining: 180,
            votes: HashMap::new(),
            winner: None,
            current_code: HashMap::new(),
        }
    }

    pub fn add_player(&mut self, wallet: String, conn_id: String) -> Result<(), &'static str> {
        if self.players.len() >= 4 {
            return Err("game full");
        }
        if self.state != GameState::Lobby {
            return Err("game already started");
        }

        let colors = ["green", "red", "blue", "yellow"];
        let color = colors[self.players.len()].to_string();

        let player = Player {
            id: wallet.clone(),
            wallet,
            cursor_color: color,
            is_host: false,
            conn_id,
        };

        self.players.push(player);
        Ok(())
    }

    pub fn get_player_by_conn(&self, conn_id: &str) -> Option<&Player> {
        self.players.iter().find(|p| p.conn_id == conn_id)
    }
}