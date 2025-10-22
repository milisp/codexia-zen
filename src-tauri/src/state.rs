use std::sync::Arc;
use tokio::sync::Mutex;

use crate::codex::CodexClient;

pub struct AppState {
    pub client: Arc<Mutex<Option<CodexClient>>>,
}

pub async fn get_client(
    state: &tauri::State<'_, AppState>,
) -> Result<CodexClient, String> {
    let client_guard = state.client.lock().await;
    client_guard
        .as_ref()
        .cloned()
        .ok_or_else(|| "CodexClient not initialized.".to_string())
}
