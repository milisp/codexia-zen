use codex_app_server_protocol::{InputItem, NewConversationParams, NewConversationResponse};
use codex_protocol::ConversationId;
use tauri::Emitter;
use tauri_plugin_log::log::{error, info};
use tokio::fs;

use crate::codex::CodexClient;
use crate::state::{AppState, get_client};

#[tauri::command]
pub async fn start_conversation(
    api_key: String,
    env_key: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mut client_guard = state.client.lock().await;

    if client_guard.is_some() {
        info!("CodexClient already initialized.");
        return Ok(());
    }

    info!("Initializing CodexClient...");

    let client = CodexClient::new(api_key, env_key);
    let mut event_rx = client.subscribe_to_events();

    let init_result = client.initialize().await;
    match init_result {
        Ok(response) => {
            if let Err(e) = app.emit("app_server_initialized", response) {
                error!("Failed to emit app_server_initialized: {:?}", e);
            }
        }
        Err(e) => {
            error!("Failed to initialize app server: {:?}", e);
            let _ = app.emit("session_init_failed", e.to_string());
            return Err(format!("Failed to initialize app server: {}", e));
        }
    }

    *client_guard = Some(client);

    tokio::spawn(async move {
        while let Ok(line_json) = event_rx.recv().await {
            if let Err(e) = app.emit("codex-event", line_json) {
                error!("Failed to emit codex-event: {:?}", e);
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn send_message(
    conversation_id: String,
    items: Vec<InputItem>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let client = get_client(&state).await?;
    info!("Sending message to conversation ID: {}", conversation_id);
    client
        .send_user_message(
            ConversationId::from_string(&conversation_id).unwrap(),
            items,
        )
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn new_conversation(
    params: NewConversationParams,
    state: tauri::State<'_, AppState>,
) -> Result<NewConversationResponse, String> {
    let client = get_client(&state).await?;
    info!("{:?}", params);
    let response = client.new_conversation(params).await.map_err(|e| {
        error!(
            "Error from codex app-server during new_conversation: {:?}",
            e
        );
        e.to_string()
    })?;

    let conversation_id = response.conversation_id.clone();

    client
        .add_conversation_listener(conversation_id.clone())
        .await
        .map_err(|e| {
            error!(
                "Error from codex app-server during add_conversation_listener: {:?}",
                e
            );
            e.to_string()
        })?;

    Ok(response)
}

#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    info!("Deleting file: {}", path);
    fs::remove_file(&path)
        .await
        .map_err(|e| format!("Failed to delete file {}: {}", path, e))?;
    Ok(())
}


#[tauri::command]
pub async fn exec_approval_request(
    request_id: i64,
    decision: bool,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let client = get_client(&state).await?;
    info!(
        "Sending exec approval response for request ID: {}",
        request_id
    );
    let response = codex_app_server_protocol::ExecCommandApprovalResponse {
        decision: if decision {
            codex_protocol::protocol::ReviewDecision::Approved
        } else {
            codex_protocol::protocol::ReviewDecision::Denied
        },
    };
    client
        .send_response_to_server_request(request_id, response)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
