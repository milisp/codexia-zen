use std::sync::Arc;
use tokio::sync::Mutex;

use crate::codex::CodexClient;

pub struct AppState {
    pub client: Arc<Mutex<Option<Arc<CodexClient>>>>,
}

