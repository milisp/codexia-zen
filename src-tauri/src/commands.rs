use tauri::{AppHandle, State, command};

use crate::codex_client::{CodexClientManager, TurnHandles};
use codex_app_server_protocol::{
    AddConversationSubscriptionResponse, NewConversationParams, NewConversationResponse,
    ThreadListParams, ThreadListResponse, ThreadResumeParams, ThreadResumeResponse,
};
use codex_protocol::ConversationId;

#[command]
pub async fn run_turn(
    app: AppHandle,
    state: State<'_, CodexClientManager>,
    prompt: String,
    cwd: Option<String>,
) -> Result<TurnHandles, String> {
    state
        .start_turn(app, prompt, cwd)
        .await
        .map_err(|err| err.to_string())
}

#[command]
pub async fn initialize_client(state: State<'_, CodexClientManager>) -> Result<(), String> {
    state.initialize().await.map_err(|err| err.to_string())
}

#[command]
pub async fn new_conversation(
    state: State<'_, CodexClientManager>,
    params: NewConversationParams,
) -> Result<NewConversationResponse, String> {
    state
        .new_conversation(params)
        .await
        .map_err(|err| err.to_string())
}

#[command]
pub async fn add_conversation_listener(
    state: State<'_, CodexClientManager>,
    conversation_id: ConversationId,
) -> Result<AddConversationSubscriptionResponse, String> {
    state
        .add_conversation_listener(conversation_id)
        .await
        .map_err(|err| err.to_string())
}

#[command]
pub async fn send_user_message(
    state: State<'_, CodexClientManager>,
    app: AppHandle,
    conversation_id: ConversationId,
    message: String,
) -> Result<(), String> {
    state
        .send_user_message(app, conversation_id, message)
        .await
        .map_err(|err| err.to_string())
}

#[command]
pub async fn list_threads(
    state: State<'_, CodexClientManager>,
    params: ThreadListParams,
) -> Result<ThreadListResponse, String> {
    state
        .list_threads(params)
        .await
        .map_err(|err| err.to_string())
}

#[command]
pub async fn resume_thread(
    state: State<'_, CodexClientManager>,
    params: ThreadResumeParams,
) -> Result<ThreadResumeResponse, String> {
    state
        .resume_thread(params)
        .await
        .map_err(|err| err.to_string())
}
