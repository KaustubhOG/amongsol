use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use std::str::FromStr;

pub type PlayerId = String;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum GameMap {
    Rust,
    Anchor,
}

impl GameMap {
    pub fn as_str(&self) -> &'static str {
        match self {
            GameMap::Rust => "rust",
            GameMap::Anchor => "anchor",
        }
    }
}

impl FromStr for GameMap {
    type Err = ();

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim().to_ascii_lowercase().as_str() {
            "rust" => Ok(GameMap::Rust),
            "anchor" => Ok(GameMap::Anchor),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum GameState {
    Lobby,
    Playing,
    CodeLocked,
    Meeting,
    Voting,
    Ended,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub id: String,
    pub wallet: String,
    pub cursor_color: String,
    pub is_host: bool,
    pub conn_id: String,
    pub stake_lamports: u64,
    pub stake_signature: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChallengeFunction {
    pub name: String,
    pub code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Challenge {
    pub id: String,
    pub functions: Vec<ChallengeFunction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub name: String,
    pub passed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edit {
    pub player_id: String,
    pub cursor_color: String,
    pub function_name: String,
    pub timestamp: u64,
    pub test_snapshot: Vec<TestResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WinnerType {
    Civilians,
    Impostor,
}

pub const COLORS: [&str; 4] = ["green", "red", "blue", "yellow"];

#[derive(Debug)]
pub struct GameSession {
    pub id: String,
    pub map: GameMap,
    pub players: Vec<Player>,
    pub impostor: Option<PlayerId>,
    pub challenge: Option<Challenge>,
    pub edit_history: Vec<Edit>,
    pub state: GameState,
    pub timer_remaining: u64,
    pub votes: HashMap<PlayerId, PlayerId>,
    pub winner: Option<WinnerType>,
    pub current_code: HashMap<String, String>,
    pub latest_test_results: Vec<TestResult>,
    pub meeting_caller_color: Option<String>,
    pub timer_stopped: Arc<AtomicBool>,
    pub started_at: Option<u64>,
    pub stake_lamports: u64,
}

impl GameSession {
    pub const DEFAULT_STAKE_LAMPORTS: u64 = 100_000_000;

    pub fn new(id: String, map: GameMap) -> Self {
        Self {
            id,
            map,
            players: Vec::new(),
            impostor: None,
            challenge: None,
            edit_history: Vec::new(),
            state: GameState::Lobby,
            timer_remaining: 180,
            votes: HashMap::new(),
            winner: None,
            current_code: HashMap::new(),
            latest_test_results: Vec::new(),
            meeting_caller_color: None,
            timer_stopped: Arc::new(AtomicBool::new(false)),
            started_at: None,
            stake_lamports: Self::DEFAULT_STAKE_LAMPORTS,
        }
    }

    pub fn add_player(&mut self, wallet: String, conn_id: String) -> Result<Player, String> {
        if self.state != GameState::Lobby {
            return Err("game already started".into());
        }
        if self.players.len() >= 4 {
            return Err("game is full".into());
        }
        let color = COLORS[self.players.len()].to_string();
        let is_host = self.players.is_empty();
        let player = Player {
            id: wallet.clone(),
            wallet,
            cursor_color: color,
            is_host,
            conn_id,
            stake_lamports: 0,
            stake_signature: None,
        };
        self.players.push(player.clone());
        Ok(player)
    }

    pub fn try_reconnect(&mut self, wallet: &str, new_conn_id: String) -> Option<Player> {
        if let Some(p) = self.players.iter_mut().find(|p| p.wallet == wallet) {
            p.conn_id = new_conn_id;
            return Some(p.clone());
        }
        None
    }

    pub fn remove_player_by_conn(&mut self, conn_id: &str) -> Option<Player> {
        if let Some(pos) = self.players.iter().position(|p| p.conn_id == conn_id) {
            let removed = self.players.remove(pos);
            if removed.is_host && !self.players.is_empty() {
                self.players[0].is_host = true;
            }
            return Some(removed);
        }
        None
    }

    pub fn player_by_conn(&self, conn_id: &str) -> Option<&Player> {
        self.players.iter().find(|p| p.conn_id == conn_id)
    }

    pub fn player_by_wallet(&self, wallet: &str) -> Option<&Player> {
        self.players.iter().find(|p| p.wallet == wallet)
    }

    pub fn mark_staked(&mut self, wallet: &str, signature: String) -> Result<(), String> {
        let player = self
            .players
            .iter_mut()
            .find(|p| p.wallet == wallet)
            .ok_or_else(|| "player not found".to_string())?;

        player.stake_lamports = self.stake_lamports;
        player.stake_signature = Some(signature);
        Ok(())
    }

    pub fn all_players_staked(&self) -> bool {
        !self.players.is_empty()
            && self
                .players
                .iter()
                .all(|player| player.stake_lamports >= self.stake_lamports)
    }

    pub fn payout_summary(&self, winner: &WinnerType) -> PayoutSummary {
        let total_pot_lamports = self.players.iter().map(|p| p.stake_lamports).sum();
        let impostor_wallet = self.impostor_wallet().unwrap_or_default();
        let recipients = match winner {
            WinnerType::Impostor => {
                if impostor_wallet.is_empty() {
                    vec![]
                } else {
                    vec![PayoutRecipient {
                        wallet: impostor_wallet,
                        lamports: total_pot_lamports,
                    }]
                }
            }
            WinnerType::Civilians => {
                let winners = self
                    .players
                    .iter()
                    .filter(|player| player.wallet != impostor_wallet)
                    .collect::<Vec<_>>();
                if winners.is_empty() {
                    vec![]
                } else {
                    let share = total_pot_lamports / winners.len() as u64;
                    let remainder = total_pot_lamports % winners.len() as u64;
                    winners
                        .iter()
                        .enumerate()
                        .map(|(idx, player)| PayoutRecipient {
                            wallet: player.wallet.clone(),
                            lamports: share + u64::from(idx == 0) * remainder,
                        })
                        .collect()
                }
            }
        };

        PayoutSummary {
            total_pot_lamports,
            recipients,
        }
    }

    pub fn all_conn_ids(&self) -> Vec<String> {
        self.players.iter().map(|p| p.conn_id.clone()).collect()
    }

    pub fn cast_vote(&mut self, voter_wallet: &str, target_wallet: &str) -> Option<WinnerType> {
        self.votes
            .insert(voter_wallet.to_string(), target_wallet.to_string());
        self.state = GameState::Voting;

        let threshold = self.players.len() / 2 + 1;
        let mut counts: HashMap<String, usize> = HashMap::new();
        for t in self.votes.values() {
            *counts.entry(t.clone()).or_insert(0) += 1;
        }

        for (ejected, count) in counts {
            if count >= threshold {
                let impostor = self.impostor.clone().unwrap_or_default();
                let winner = if ejected == impostor {
                    WinnerType::Civilians
                } else {
                    WinnerType::Impostor
                };
                self.winner = Some(winner.clone());
                self.state = GameState::Ended;
                self.timer_stopped.store(true, Ordering::SeqCst);
                return Some(winner);
            }
        }
        None
    }

    pub fn vote_counts(&self) -> HashMap<String, usize> {
        let mut counts: HashMap<String, usize> = HashMap::new();
        for t in self.votes.values() {
            *counts.entry(t.clone()).or_insert(0) += 1;
        }
        counts
    }

    pub fn impostor_color(&self) -> Option<String> {
        let imp_wallet = self.impostor.as_deref()?;
        self.players
            .iter()
            .find(|p| p.wallet == imp_wallet)
            .map(|p| p.cursor_color.clone())
    }

    pub fn impostor_wallet(&self) -> Option<String> {
        self.impostor.clone()
    }

    pub fn elapsed_secs(&self) -> u64 {
        let start = self.started_at.unwrap_or(0);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        now.saturating_sub(start)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayoutRecipient {
    pub wallet: String,
    pub lamports: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayoutSummary {
    pub total_pot_lamports: u64,
    pub recipients: Vec<PayoutRecipient>,
}
