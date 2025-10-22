use std::path::PathBuf;
use std::sync::Arc;

use codex_app_server_protocol::{
    AddConversationListenerParams, NewConversationParams, NewConversationResponse,
    SendUserMessageParams, SendUserMessageResponse,
};
use log::{error, info, warn};
use tauri::{AppHandle, State};

use crate::codex::CodexClient;
use crate::state::AppState;

#[tauri::command]
pub async fn initialize_codex(
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    info!("Initializing Codex client");
    let _ = get_or_init_client(&state, &app_handle).await?;
    Ok(())
}

#[tauri::command]
pub async fn new_conversation(
    params: NewConversationParams,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<NewConversationResponse, String> {
    info!(
        "Creating new conversation; model={:?} cwd={:?}",
        params.model, params.cwd
    );
    let client = get_or_init_client(&state, &app_handle).await?;
    match client.new_conversation(params).await {
        Ok(conversation) => {
            info!(
                "New conversation created: {}",
                conversation.conversation_id
            );
            if let Err(err) = client
                .add_conversation_listener(AddConversationListenerParams {
                    conversation_id: conversation.conversation_id.clone(),
                })
                .await
            {
                error!(
                    "Failed to register conversation listener for {}: {err}",
                    conversation.conversation_id
                );
                return Err(err);
            }
            info!(
                "Listener registered for conversation {}",
                conversation.conversation_id
            );
            Ok(conversation)
        }
        Err(err) => {
            error!("Failed to create conversation: {err}");
            Err(err)
        }
    }
}

#[tauri::command]
pub async fn send_user_message(
    params: SendUserMessageParams,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<SendUserMessageResponse, String> {
    let client = get_or_init_client(&state, &app_handle).await?;
    let conversation_id = params.conversation_id.clone();
    let item_count = params.items.len();

    if item_count == 0 {
        warn!(
            "Attempted to send empty item list to conversation {}",
            conversation_id
        );
        return Err("Message items cannot be empty.".to_string());
    }

    info!(
        "Forwarding send_user_message to conversation {} (items={})",
        conversation_id, item_count
    );

    match client.send_user_message(params).await {
        Ok(response) => {
            info!("Message accepted for {}", conversation_id);
            Ok(response)
        }
        Err(err) => {
            error!("Failed to send message to {conversation_id}: {err}");
            Err(err)
        }
    }
}

#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        warn!("delete_file invoked with empty path");
        return Err("Path is empty.".to_string());
    }

    info!("Deleting conversation file {}", trimmed);
    let path_buf = PathBuf::from(trimmed);
    tokio::fs::remove_file(path_buf)
        .await
        .map_err(|err| {
            error!("Failed to delete file {trimmed}: {err}");
            format!("Failed to delete file: {err}")
        })
}

async fn get_or_init_client(
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
