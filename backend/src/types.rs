use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::mpsc::UnboundedSender;

pub type PlayerSender = UnboundedSender<String>;
pub type Connections = Arc<DashMap<String, PlayerSender>>;