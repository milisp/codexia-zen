use codex_app_server_protocol::{InputItem, NewConversationParams, NewConversationResponse};
use codex_protocol::ConversationId;
use codex_protocol::protocol::EventMsg::{AgentMessageDelta, AgentReasoningRawContentDelta};
use tauri::Emitter;
use tauri_plugin_log::log::{debug, error, info};

use crate::codex::CodexClient;
use crate::state::{AppState, get_client};

#[tauri::command]
pub async fn start_chat_session(
    session_id: String,
    api_key: String,
    env_key: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    let mut clients_guard = state.clients.lock().await;

    if clients_guard.contains_key(&session_id) {
        return Ok(session_id);
    }

    info!(
        "Initializing new chat session for session_id {}...",
        session_id
    );

    let client = CodexClient::new(api_key, env_key);
    let mut event_rx = client.subscribe_to_events();
    let client_session_id = session_id.clone();

    let init_result = client.initialize().await;
    match init_result {
        Ok(response) => {
            if let Err(e) = app.emit(
                "app_server_initialized",
                (client_session_id.clone(), response),
            ) {
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
            let _ = app.emit(
                "session_init_failed",
                (client_session_id.clone(), e.to_string()),
            );
            return Err(format!(
                "Failed to initialize app server for session_id {}: {}",
                session_id, e
            ));
        }
    }

    clients_guard.insert(session_id.clone(), client);

    debug!("Current active sessions : {}", clients_guard.len());

    tokio::spawn(async move {
        while let Ok(event) = event_rx.recv().await {
            if !matches!(
                event.msg,
                AgentMessageDelta(_) | AgentReasoningRawContentDelta(_)
            ) {
                info!(
                    "Emitting codex-event for session_id {}: {:?}",
                    client_session_id, event
                );
            }
            if let Err(e) = app.emit(
                "codex-event",
                (client_session_id.clone(), event.id, event.msg),
            ) {
                error!(
                    "Failed to emit codex-event for session_id {}: {:?}",
                    client_session_id, e
                );
            }
        }
        info!(
            "Frontend event loop stopped for session_id {}.",
            client_session_id
        );
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
pub async fn exec_approval_request(
    session_id: String,
    request_id: i64,
    decision: bool,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let client = get_client(&state, &session_id).await?;
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
