use axum::extract::ws::{Message, WebSocket};
use axum::{
    extract::{State, WebSocketUpgrade},
    response::Response,
};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::ws::messages::{ClientMessage, ServerMessage};
use crate::ws::router::handle_client_message;
use crate::AppState;

pub async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sink, mut stream) = socket.split();
    let conn_id = Uuid::new_v4().to_string();

    let (tx, mut rx) = mpsc::unbounded_channel::<String>();

    state.connections.insert(conn_id.clone(), tx);

    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sink.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    while let Some(Ok(msg)) = stream.next().await {
        if let Message::Text(text) = msg {
            match serde_json::from_str::<ClientMessage>(&text) {
                Ok(client_msg) => {
                    handle_client_message(client_msg, &conn_id, &state).await;
                }
                Err(_) => {
                    let err = ServerMessage::Error {
                        message: "invalid message format".to_string(),
                    };
                    if let Ok(json) = serde_json::to_string(&err) {
                        if let Some(sender) = state.connections.get(&conn_id) {
                            let _ = sender.send(json);
                        }
                    }
                }
            }
        }
    }

    state.connections.remove(&conn_id);

    if let Some((game_id, _removed, remaining)) = state.game_manager.remove_conn(&conn_id) {
        let players = remaining
            .iter()
            .map(|p| crate::ws::messages::PlayerInfo {
                color: p.cursor_color.clone(),
                wallet: p.wallet.clone(),
                is_host: p.is_host,
            })
            .collect::<Vec<_>>();

        crate::ws::router::broadcast_to_game(
            &game_id,
            ServerMessage::PlayerLeft { players },
            &state,
        )
        .await;
    }
}
