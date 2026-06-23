use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("game not found")]
    GameNotFound,
    #[error("game already started")]
    GameAlreadyStarted,
    #[error("game is full")]
    GameFull,
    #[error("not authorized")]
    NotAuthorized,
    #[error("invalid state")]
    InvalidState,
    #[error("player not found")]
    PlayerNotFound,
    #[error("{0}")]
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = match &self {
            AppError::GameNotFound => StatusCode::NOT_FOUND,
            AppError::GameAlreadyStarted => StatusCode::CONFLICT,
            AppError::GameFull => StatusCode::CONFLICT,
            AppError::NotAuthorized => StatusCode::UNAUTHORIZED,
            AppError::InvalidState => StatusCode::BAD_REQUEST,
            AppError::PlayerNotFound => StatusCode::NOT_FOUND,
            AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        (status, Json(json!({ "error": self.to_string() }))).into_response()
    }
}