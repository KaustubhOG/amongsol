use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};

use crate::errors::AppError;
use crate::AppState;

#[derive(Deserialize)]
pub struct CreateGameRequest {
    pub wallet: String,
}

#[derive(Serialize)]
pub struct CreateGameResponse {
    pub game_id: String,
}

#[derive(Deserialize)]
pub struct JoinGameRequest {
    pub game_id: String,
    pub wallet: String,
}

#[derive(Serialize)]
pub struct JoinGameResponse {
    pub success: bool,
    pub game_id: String,
}

pub async fn create_game_handler(
    State(state): State<AppState>,
    Json(body): Json<CreateGameRequest>,
) -> Result<Json<CreateGameResponse>, AppError> {
    if body.wallet.trim().is_empty() {
        return Err(AppError::Internal("wallet is required".to_string()));
    }
    let game_id = state.game_manager.create_game();
    Ok(Json(CreateGameResponse { game_id }))
}

pub async fn join_game_handler(
    State(state): State<AppState>,
    Json(body): Json<JoinGameRequest>,
) -> Result<Json<JoinGameResponse>, AppError> {
    state
        .game_manager
        .join_game(&body.game_id, body.wallet, "http_placeholder".to_string())
        .map_err(|e| e)?;

    Ok(Json(JoinGameResponse {
        success: true,
        game_id: body.game_id,
    }))
}
