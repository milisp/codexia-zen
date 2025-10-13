use codex_app_server_protocol::{
    AddConversationListenerParams, AddConversationSubscriptionResponse, AuthMode, ClientInfo,
    ConversationSummary, InitializeParams, InitializeResponse, InputItem,
    ListConversationsResponse, NewConversationParams, NewConversationResponse,
    SendUserMessageParams,
};
use codex_protocol::{ConversationId, protocol::EventMsg};
use std::path::Path;
use tauri::Emitter;
use tauri_plugin_log::log::{error, info};
use ts_rs::TS;

use crate::codex::CodexClient;
use crate::state::{get_client, AppState};

#[cfg(debug_assertions)]
pub fn export_ts_types() {
    let out_dir = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("src")
        .join("bindings");
    std::fs::create_dir_all(&out_dir).unwrap();

    AuthMode::export_all_to(&out_dir).unwrap();
    NewConversationParams::export_all_to(&out_dir).unwrap();
    NewConversationResponse::export_all_to(&out_dir).unwrap();
    ConversationSummary::export_all_to(&out_dir).unwrap();
    EventMsg::export_all_to(&out_dir).unwrap();
    InitializeParams::export_all_to(&out_dir).unwrap();
    ClientInfo::export_all_to(&out_dir).unwrap();
    InitializeResponse::export_all_to(&out_dir).unwrap();
    SendUserMessageParams::export_all_to(&out_dir).unwrap();
    ListConversationsResponse::export_all_to(&out_dir).unwrap();
    AddConversationListenerParams::export_all_to(&out_dir).unwrap();
    AddConversationSubscriptionResponse::export_all_to(&out_dir).unwrap();
    InputItem::export_all_to(&out_dir).unwrap();
}

#[tauri::command]
pub async fn start_chat_session(
    session_id: String,
    api_key: String,
    provider: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let mut clients_guard = state.clients.lock().await;

    // Log current number of active sessions
    info!("Current active sessions before start: {}", clients_guard.len());

    if clients_guard.contains_key(&session_id) {
        info!("Client for session_id {} already initialized.", session_id);
        return Ok(session_id);
    }

    info!("Initializing new chat session for session_id {}...", session_id);

    let client = CodexClient::new(api_key, provider);
    let mut event_rx = client.subscribe_to_events();
    let client_session_id = session_id.clone();

    let init_result = client.initialize().await;
    match init_result {
        Ok(response) => {
            info!(
                "App server initialized for session_id {}: {:?}",
                session_id, response
            );
            if let Err(e) = app.emit("app_server_initialized", (client_session_id.clone(), response)) {
                error!(
                    "Failed to emit app_server_initialized for session_id {}: {:?}",
                    client_session_id, e
                );
            }
        }
        Err(e) => {
            error!(
                "Failed to initialize app server for session_id {}: {:?}",
                session_id, e
            );
            let _ = app.emit("app_server_error", (client_session_id.clone(), e.to_string()));
            return Err(format!(
                "Failed to initialize app server for session_id {}: {}",
                session_id, e
            ));
        }
    }

    clients_guard.insert(session_id.clone(), client);

    // Log updated number of active sessions
    info!("Current active sessions after start: {}", clients_guard.len());

    tokio::spawn(async move {
        while let Ok(event) = event_rx.recv().await {
            info!("Emitting codex-event for session_id {}: {:?}", client_session_id, event);
            if let Err(e) = app.emit("codex-event", (client_session_id.clone(), event)) {
                error!(
                    "Failed to emit codex-event for session_id {}: {:?}",
                    client_session_id, e
                );
            }
        }
        info!("Frontend event loop stopped for session_id {}.", client_session_id);
    });

    Ok(session_id)
}

#[tauri::command]
pub async fn send_message(
    session_id: String,
    conversation_id: String,
    items: Vec<InputItem>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let client = get_client(&state, &session_id).await?;
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
    session_id: String,
    params: NewConversationParams,
    state: tauri::State<'_, AppState>,
) -> Result<NewConversationResponse, String> {
    let client = get_client(&state, &session_id).await?;
    let response = client.new_conversation(params).await.map_err(|e| {
        error!(
            "Error from codex app-server during new_conversation: {:?}",
            e
        );
        e.to_string()
    })?;

    let conversation_id = response.conversation_id.clone();
    info!("New conversation created with ID: {}", conversation_id.to_string());

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
