use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde_json::json;

#[derive(Debug)]
pub enum AppError {
    GameNotFound,
    GameFull,
    AlreadyStarted,
    NotInGame,
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::GameNotFound => (StatusCode::NOT_FOUND, "game not found"),
            AppError::GameFull => (StatusCode::BAD_REQUEST, "game is full"),
            AppError::AlreadyStarted => (StatusCode::BAD_REQUEST, "game already started"),
            AppError::NotInGame => (StatusCode::BAD_REQUEST, "not in a game"),
            AppError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal error"),
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}