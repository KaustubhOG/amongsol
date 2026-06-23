use axum::{
    routing::{get, post},
    Router,
};
use dashmap::DashMap;
use std::{env, sync::Arc};
use tower_http::cors::CorsLayer;

mod compiler;
mod errors;
mod game;
mod types;
mod ws;

use game::manager::GameManager;
use types::PlayerSender;
use ws::handler::ws_handler;
use ws::routes::{create_game_handler, join_game_handler};

#[derive(Clone)]
pub struct AppState {
    pub game_manager: Arc<GameManager>,
    pub connections: Arc<DashMap<String, PlayerSender>>,
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

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS game_results (
            id SERIAL PRIMARY KEY,
            game_id TEXT NOT NULL,
            winner TEXT NOT NULL,
            impostor_wallet TEXT NOT NULL,
            impostor_color TEXT NOT NULL,
            player_count INT NOT NULL,
            duration_secs BIGINT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )",
    )
    .execute(&db)
    .await
    .expect("failed to run migrations");

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