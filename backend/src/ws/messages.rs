use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::game::session::TestResult;

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum ClientMessage {
    JoinGame { game_id: String, wallet: String },
    StartGame,
    EditCode { function_name: String, code: String },
    RunTests,
    CallMeeting,
    CastVote { target_id: String },
}

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type")]
pub enum ServerMessage {
    GameJoined {
        game_id: String,
        your_color: String,
        players: Vec<PlayerInfo>,
    },
    PlayerJoined {
        players: Vec<PlayerInfo>,
    },
    GameStarted {
        functions: Vec<FunctionInfo>,
    },
    TestResults {
        results: Vec<TestResult>,
        triggered_by_color: String,
    },
    PlayerEditing {
        function_name: String,
        cursor_color: String,
    },
    TimerTick {
        remaining: u64,
    },
    CodeLocked,
    MeetingCalled {
        edit_history: Vec<EditInfo>,
        caller_color: String,
    },
    VoteUpdate {
        votes: HashMap<String, u32>,
    },
    GameOver {
        winner: String,
        impostor_color: String,
        impostor_wallet: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Serialize, Clone)]
pub struct PlayerInfo {
    pub color: String,
    pub is_host: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct FunctionInfo {
    pub name: String,
    pub code: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct EditInfo {
    pub cursor_color: String,
    pub function_name: String,
    pub timestamp: u64,
    pub result: String,
}