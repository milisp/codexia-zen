use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::codex::CodexClient;

pub struct AppState {
    pub clients: Arc<Mutex<HashMap<String, CodexClient>>>,
}

pub async fn get_client(
    state: &tauri::State<'_, AppState>,
    session_id: &str,
) -> Result<CodexClient, String> {
    let clients_guard = state.clients.lock().await;
    clients_guard
        .get(session_id)
        .cloned()
        .ok_or_else(|| format!("Client for session_id '{}' not found.", session_id))
}
