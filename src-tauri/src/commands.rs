use tauri::{AppHandle, State, command};

use codex_app_server_protocol::{
    AddConversationSubscriptionResponse, NewConversationParams, NewConversationResponse, RequestId,
    ThreadResumeParams, ThreadResumeResponse,
    TurnInterruptResponse,
};
use codex_protocol::ConversationId;
use codex_protocol::protocol::ReviewDecision;
use crate::agent::codex::{CodexClientManager, TurnHandles};

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
pub async fn turn_interrupt(
    state: State<'_, CodexClientManager>,
    thread_id: ConversationId,
    turn_id: String,
) -> Result<TurnInterruptResponse, String> {
    state
        .turn_interrupt(thread_id, turn_id)
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

#[command]
pub async fn respond_exec_command_approval(
    state: State<'_, CodexClientManager>,
    request_id: String,
    decision: String,
) -> Result<(), String> {
    let request_id = RequestId::String(request_id);
    let decision = parse_review_decision(&decision)?;
    state
        .respond_exec_approval(request_id, decision)
        .await
        .map_err(|err| err.to_string())
}

#[command]
pub async fn respond_apply_patch_approval(
    state: State<'_, CodexClientManager>,
    request_id: String,
    decision: String,
) -> Result<(), String> {
    let request_id = RequestId::String(request_id);
    let decision = parse_review_decision(&decision)?;
    state
        .respond_patch_approval(request_id, decision)
        .await
        .map_err(|err| err.to_string())
}

fn parse_review_decision(value: &str) -> Result<ReviewDecision, String> {
    match value {
        "approved" => Ok(ReviewDecision::Approved),
        "approved_for_session" => Ok(ReviewDecision::ApprovedForSession),
        "denied" => Ok(ReviewDecision::Denied),
        "abort" => Ok(ReviewDecision::Abort),
        other => Err(format!("unsupported review decision: {other}")),
    }
}
