use tokio::sync::mpsc::UnboundedSender;

pub type PlayerSender = UnboundedSender<String>;
