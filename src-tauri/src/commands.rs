use crate::codex::handles::CodexClientHandle;
use crate::state::AppState;
use anyhow::Result;
use codex_app_server_protocol::{
    ApprovalDecision, ExecPolicyAmendment, RequestId, ThreadListParams, ThreadListResponse,
    ThreadResumeParams, ThreadResumeResponse, ThreadStartParams, ThreadStartResponse,
    TurnInterruptParams, TurnInterruptResponse, TurnStartParams, TurnStartResponse,
};
use log::{debug, error, info};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexError {
    pub message: String,
}

impl From<anyhow::Error> for CodexError {
    fn from(err: anyhow::Error) -> Self {
        CodexError {
            message: err.to_string(),
        }
    }
}

#[tauri::command]
pub async fn codex_initialize(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), CodexError> {
    let mut client_lock = state.codex_client.lock().unwrap();

    // Check if already initialized (while holding the lock)
    if client_lock.is_some() {
        info!("Codex client already initialized, skipping");
        return Ok(());
    }

    info!("Initializing Codex client");

    let handle = CodexClientHandle::spawn_and_initialize(app.clone()).map_err(|e| {
        error!("Failed to spawn and initialize Codex client: {}", e);
        e
    })?;

    *client_lock = Some(handle);
    info!("Codex client initialization complete");

    Ok(())
}

#[tauri::command]
pub async fn thread_start(
    params: ThreadStartParams,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<ThreadStartResponse, CodexError> {
    info!("thread_start called with params: {:?}", params);

    let handle = state.get_or_init_client(&app).map_err(|e| {
        error!("Failed to get or initialize client: {}", e);
        e
    })?;

    info!("Calling handle.thread_start");
    let response = handle.thread_start(params).map_err(|e| {
        error!("thread_start execution failed: {}", e);
        e
    })?;

    info!("thread_start completed successfully, thread_id: {:?}", response.thread);
    Ok(response)
}

#[tauri::command]
pub async fn thread_resume(
    params: ThreadResumeParams,
    state: State<'_, AppState>,
) -> Result<ThreadResumeResponse, CodexError> {
    debug!("thread_resume called with params: {:?}", params);

    let handle = state.get_client().map_err(|e| {
        error!("thread_resume failed: {}", e);
        e
    })?;

    let response = handle.thread_resume(params).map_err(|e| {
        error!("thread_resume execution failed: {}", e);
        e
    })?;

    info!("thread_resume completed successfully");
    Ok(response)
}

#[tauri::command]
pub async fn thread_list(
    params: ThreadListParams,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<ThreadListResponse, CodexError> {
    debug!("thread_list called with params: {:?}", params);

    let handle = state.get_or_init_client(&app).map_err(|e| {
        error!("thread_list failed: {}", e);
        e
    })?;

    let response = handle.thread_list(params).map_err(|e| {
        error!("thread_list execution failed: {}", e);
        e
    })?;

    info!("thread_list completed successfully");
    Ok(response)
}

#[tauri::command]
pub async fn turn_start(
    params: TurnStartParams,
    state: State<'_, AppState>,
) -> Result<TurnStartResponse, CodexError> {
    debug!("turn_start called with params: {:?}", params);

    let handle = state.get_client().map_err(|e| {
        error!("turn_start failed: {}", e);
        e
    })?;

    let response = handle.turn_start(params).map_err(|e| {
        error!("turn_start execution failed: {}", e);
        e
    })?;

    info!("turn_start completed successfully");
    Ok(response)
}

#[tauri::command]
pub async fn turn_interrupt(
    params: TurnInterruptParams,
    state: State<'_, AppState>,
) -> Result<TurnInterruptResponse, CodexError> {
    debug!("turn_interrupt called with params: {:?}", params);

    let handle = state.get_client().map_err(|e| {
        error!("turn_interrupt failed: {}", e);
        e
    })?;

    let response = handle.turn_interrupt(params).map_err(|e| {
        error!("turn_interrupt execution failed: {}", e);
        e
    })?;

    info!("turn_interrupt completed successfully");
    Ok(response)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalResponse {
    pub request_id: String,
    pub decision: ApprovalDecisionType,
    pub is_command_execution: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ApprovalDecisionType {
    Accept,
    AcceptForSession,
    AcceptWithExecpolicyAmendment { execpolicy_amendment: Vec<String> },
    Decline,
    Cancel,
}

#[tauri::command]
pub async fn respond_to_approval(
    response: ApprovalResponse,
    state: State<'_, AppState>,
) -> Result<(), CodexError> {
    debug!("respond_to_approval called with request_id: {}, decision: {:?}",
           response.request_id, response.decision);

    let handle = state.get_client().map_err(|e| {
        error!("respond_to_approval failed: {}", e);
        e
    })?;

    let decision = match response.decision {
        ApprovalDecisionType::Accept => ApprovalDecision::Accept,
        ApprovalDecisionType::AcceptForSession => ApprovalDecision::AcceptForSession,
        ApprovalDecisionType::AcceptWithExecpolicyAmendment { execpolicy_amendment } => {
            ApprovalDecision::AcceptWithExecpolicyAmendment {
                execpolicy_amendment: ExecPolicyAmendment {
                    command: execpolicy_amendment,
                },
            }
        }
        ApprovalDecisionType::Decline => ApprovalDecision::Decline,
        ApprovalDecisionType::Cancel => ApprovalDecision::Cancel,
    };

    let request_id = RequestId::String(response.request_id.clone());

    handle.respond_to_approval(request_id, decision, response.is_command_execution).map_err(|e| {
        error!("respond_to_approval execution failed: {}", e);
        e
    })?;

    info!("respond_to_approval completed successfully for request_id: {}", response.request_id);
    Ok(())
}
