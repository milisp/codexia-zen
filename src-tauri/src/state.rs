use std::sync::Arc;
use tokio::sync::Mutex;
use log::{info};
use tauri::{AppHandle, State};

use crate::codex::CodexClient;

pub struct AppState {
    pub client: Arc<Mutex<Option<Arc<CodexClient>>>>,
}

pub async fn get_or_init_client(
    state: &State<'_, AppState>,
    app_handle: &AppHandle,
) -> Result<Arc<CodexClient>, String> {
    if let Some(existing) = {
        let guard = state.client.lock().await;
        guard.clone()
    } {
        return Ok(existing);
    }

    info!("Starting Codex app-server process");
    let client = CodexClient::spawn(app_handle.clone()).await?;
    info!("Codex app-server spawned");

    let mut guard = state.client.lock().await;
    if let Some(existing) = guard.as_ref() {
        return Ok(existing.clone());
    }
    *guard = Some(client.clone());
    Ok(client)
}

