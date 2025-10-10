// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_log::log::{info, error};
use codex_app_server_protocol::{
    AddConversationListenerParams, AddConversationSubscriptionResponse, AuthMode, ClientInfo,
    ConversationSummary, InitializeParams, InitializeResponse, InputItem,
    ListConversationsResponse, NewConversationParams, NewConversationResponse,
    SendUserMessageParams,
};
use codex_protocol::{ConversationId, protocol::EventMsg};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::sync::Mutex;
use ts_rs::TS;
use uuid::Uuid;

use crate::codex_integration::CodexAppServerClient;
mod codex_integration;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, TS)]
pub struct Message {
    pub id: String,
    pub text: String,
    pub sender: String,
    pub timestamp: i64,
}

pub struct AppState {
    clients: Arc<Mutex<HashMap<String, CodexAppServerClient>>>,
}

#[cfg(debug_assertions)]
fn export_ts_types() {
    let out_dir = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("src")
        .join("bindings");
    std::fs::create_dir_all(&out_dir).unwrap();

    // Use ts-rs runtime export helpers. These export the type and all of its
    // dependencies into the provided directory. `export_to` is an attribute
    // used with `#[ts(...)]` on the type definition; at runtime the methods
    // provided by the `TS` trait are `export`, `export_all`, and `export_all_to`.
    AuthMode::export_all_to(&out_dir).unwrap();
    NewConversationParams::export_all_to(&out_dir).unwrap();
    NewConversationResponse::export_all_to(&out_dir).unwrap();
    ConversationSummary::export_all_to(&out_dir).unwrap();
    EventMsg::export_all_to(&out_dir).unwrap();
    InitializeParams::export_all_to(&out_dir).unwrap();
    ClientInfo::export_all_to(&out_dir).unwrap();
    // ClientCapabilities::export_all_to(&out_dir).unwrap();
    InitializeResponse::export_all_to(&out_dir).unwrap();
    // ServerInfo::export_all_to(&out_dir).unwrap();
    SendUserMessageParams::export_all_to(&out_dir).unwrap();
    ListConversationsResponse::export_all_to(&out_dir).unwrap();
    AddConversationListenerParams::export_all_to(&out_dir).unwrap();
    AddConversationSubscriptionResponse::export_all_to(&out_dir).unwrap();
    InputItem::export_all_to(&out_dir).unwrap();
    Message::export_all_to(&out_dir).unwrap();
}

async fn get_client(
    state: &tauri::State<'_, AppState>,
    session_id: &str,
) -> Result<CodexAppServerClient, String> {
    let clients_guard = state.clients.lock().await;
    clients_guard
        .get(session_id)
        .cloned() // Clone the client if it's found
        .ok_or_else(|| format!("Client for session_id '{}' not found.", session_id))
}

#[tauri::command]
async fn start_chat_session(
    session_id: String,
    api_key: String,
    provider: String,
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let mut clients_guard = state.clients.lock().await;
    if clients_guard.contains_key(&session_id) {
        info!("Client for session_id {} already initialized.", session_id);
        return Ok(session_id);
    }

    info!(
        "Initializing new chat session for session_id {}...",
        session_id
    );
    let new_client = codex_integration::CodexAppServerClient::new(api_key, provider);

    let mut event_rx = new_client.subscribe_to_events();
    let client_session_id = session_id.clone();

    match new_client.initialize().await {
        Ok(response) => {
            info!(
                "App server initialized for session_id {}: {:?}",
                session_id, response
            );
            app_handle
                .emit(
                    "app_server_initialized",
                    (client_session_id.clone(), response),
                )
                .unwrap();
        }
        Err(e) => {
            error!(
                "Failed to initialize app server for session_id {}: {:?}",
                session_id, e
            );
            app_handle
                .emit(
                    "app_server_error",
                    (client_session_id.clone(), e.to_string()),
                )
                .unwrap();
            return Err(format!(
                "Failed to initialize app server for session_id {}: {}",
                session_id, e
            ));
        }
    }

    clients_guard.insert(session_id.clone(), new_client);

    tokio::spawn(async move {
        while let Ok(event) = event_rx.recv().await {
            // println!("Event received for frontend for session_id {}: {:?}", client_session_id, event);
            app_handle
                .emit("codex_event", (client_session_id.clone(), event))
                .unwrap();
        }
        info!(
            "Frontend event loop stopped for session_id {}.",
            client_session_id
        );
    });

    Ok(session_id)
}

#[tauri::command]
async fn send_message(
    session_id: String,
    conversation_id: String,
    items: Vec<InputItem>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let client = get_client(&state, &session_id).await?;
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
async fn new_conversation(
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

    client
        .add_conversation_listener(conversation_id.clone())
        .await
        .map_err(|e| e.to_string())?;

    Ok(response)
}

#[tauri::command]
async fn list_conversations(
    session_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<ListConversationsResponse, String> {
    let client = get_client(&state, &session_id).await?;
    let response = client
        .list_conversations()
        .await
        .map_err(|e| e.to_string())?;
    info!("list_conversations response: {:?}", response);
    Ok(response)
}

#[tauri::command]
async fn get_conversation_history(
    session_id: String,
    conversation_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Message>, String> {
    let client = get_client(&state, &session_id).await?;
    let events = client
        .get_conversation_history(ConversationId::from_string(&conversation_id).unwrap())
        .await
        .map_err(|e| e.to_string())?;

    let mut messages = Vec::new();
    for event in events {
        match event {
            EventMsg::UserMessage(message) => {
                messages.push(Message {
                    id: Uuid::new_v4().to_string(),
                    text: message.message,
                    sender: "user".to_string(),
                    timestamp: chrono::Local::now().timestamp_millis(),
                });
            }
            EventMsg::AgentMessage(message) => {
                messages.push(Message {
                    id: Uuid::new_v4().to_string(),
                    text: message.message,
                    sender: "agent".to_string(),
                    timestamp: chrono::Local::now().timestamp_millis(),
                });
            }
            _ => {}
        }
    }
    Ok(messages)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .setup(|app| {
            #[cfg(debug_assertions)]
            export_ts_types();

            app.manage(AppState {
                clients: Arc::new(Mutex::new(HashMap::new())),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_chat_session,
            send_message,
            new_conversation,
            list_conversations,
            get_conversation_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
