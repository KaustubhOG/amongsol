use axum::{
    extract::{State, WebSocketUpgrade},
    response::Response,
};
use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::AppState;
use crate::ws::messages::{ClientMessage, ServerMessage};
use crate::ws::router::handle_client_message;

pub type PlayerSender = futures_util::stream::SplitSink<WebSocket, Message>;

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let (sender, mut receiver) = socket.split();
    let conn_id = Uuid::new_v4().to_string();
    let sender = Arc::new(Mutex::new(sender));

    state.connections.insert(conn_id.clone(), sender.clone());

    while let Some(Ok(msg)) = receiver.next().await {
        if let Message::Text(text) = msg {
            match serde_json::from_str::<ClientMessage>(&text) {
                Ok(client_msg) => {
                    handle_client_message(client_msg, &conn_id, &state).await;
                }
                Err(_) => {
                    let err = ServerMessage::Error {
                        message: "invalid message format".to_string(),
                    };
                    let json = serde_json::to_string(&err).unwrap();
                    sender.lock().await.send(Message::Text(json.into())).await.ok();
                }
            }
        }
    }

    state.connections.remove(&conn_id);
    state.game_manager.remove_conn(&conn_id);
}