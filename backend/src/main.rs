use axum::{
    extract::{State, WebSocketUpgrade},
    response::Response,
    routing::{get, post},
    Router,
};
use dashmap::DashMap;
use std::{env, sync::Arc};
use tower_http::cors::CorsLayer;
use tracing_subscriber;

mod compiler;
mod errors;
mod game;
mod ws;

use game::manager::GameManager;
use ws::handler::ws_handler;
use ws::routes::{create_game_handler, join_game_handler};

#[derive(Clone)]
pub struct AppState {
    pub game_manager: Arc<GameManager>,
    pub connections: Arc<DashMap<String, Arc<tokio::sync::Mutex<ws::handler::PlayerSender>>>>,
    pub db: Arc<sqlx::PgPool>,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let db = sqlx::PgPool::connect(&database_url)
        .await
        .expect("failed to connect to database");

    let state = AppState {
        game_manager: Arc::new(GameManager::new()),
        connections: Arc::new(DashMap::new()),
        db: Arc::new(db),
    };

    let app = Router::new()
        .route("/ws", get(ws_handler))
        .route("/game/create", post(create_game_handler))
        .route("/game/join", post(join_game_handler))
        .with_state(state)
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080")
        .await
        .expect("failed to bind port 8080");

    tracing::info!("backend running on port 8080");
    axum::serve(listener, app).await.expect("server error");
}
