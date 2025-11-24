use anyhow::{anyhow, bail, Context, Result};
use codex_app_server_protocol::{
    ApplyPatchApprovalParams, ApplyPatchApprovalResponse, ApprovalDecision,
    CommandExecutionRequestAcceptSettings, CommandExecutionRequestApprovalParams,
    CommandExecutionRequestApprovalResponse, ExecCommandApprovalParams,
    ExecCommandApprovalResponse, FileChangeRequestApprovalParams,
    FileChangeRequestApprovalResponse, JSONRPCMessage, JSONRPCRequest, JSONRPCResponse,
    RequestId, ServerRequest,
};
use codex_protocol::protocol::ReviewDecision;
use log::{debug, info, warn};
use serde::Serialize;
use serde_json;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;
use tokio::sync::oneshot;

use super::{CodexClient, APPROVAL_REQUEST_TOPIC};

impl CodexClient {
    pub(super) async fn handle_server_request(
        &mut self,
        request: JSONRPCRequest,
        app: Option<&AppHandle>,
    ) -> Result<()> {
        let server_request = ServerRequest::try_from(request)
            .context("failed to deserialize ServerRequest from JSONRPCRequest")?;

        match server_request {
            ServerRequest::CommandExecutionRequestApproval { request_id, params } => {
                self.handle_command_execution_request_approval(request_id, params)
                    .await?;
            }
            ServerRequest::FileChangeRequestApproval { request_id, params } => {
                self.handle_file_change_request_approval(request_id, params)
                    .await?;
            }
            ServerRequest::ExecCommandApproval { request_id, params } => {
                self.handle_exec_command_approval(request_id, params, app)
                    .await?;
            }
            ServerRequest::ApplyPatchApproval { request_id, params } => {
                self.handle_apply_patch_approval(request_id, params, app).await?;
            }
        }

        Ok(())
    }

    async fn handle_command_execution_request_approval(
        &mut self,
        request_id: RequestId,
        params: CommandExecutionRequestApprovalParams,
    ) -> Result<()> {
        info!(
            "command execution approval requested for thread {}, turn {}, item {}",
            params.thread_id, params.turn_id, params.item_id
        );

        let response = CommandExecutionRequestApprovalResponse {
            decision: ApprovalDecision::Accept,
            accept_settings: Some(CommandExecutionRequestAcceptSettings { for_session: false }),
        };
        self.send_server_request_response(request_id, &response)
            .await?;
        Ok(())
    }

    async fn handle_exec_command_approval(
        &mut self,
        request_id: RequestId,
        params: ExecCommandApprovalParams,
        app: Option<&AppHandle>,
    ) -> Result<()> {
        info!(
            "exec approval requested for conversation {} command {:?}",
            params.conversation_id, params.command
        );

        let (sender, receiver) = oneshot::channel();
        self.pending_exec_approvals
            .insert(request_id.clone(), sender);

        let payload = ApprovalRequestNotificationMessage::ExecCommand {
            request_id: request_id.clone(),
            params,
        };
        if let Some(app) = app {
            app.emit(APPROVAL_REQUEST_TOPIC, &payload)
                .context("failed to emit exec approval request")?;
        }

        let decision = match receiver.await {
            Ok(decision) => decision,
            Err(_) => {
                warn!(
                    "exec approval response receiver dropped for request {request_id:?}; defaulting to Denied"
                );
                let _ = self.pending_exec_approvals.remove(&request_id);
                ReviewDecision::Denied
            }
        };

        let response = ExecCommandApprovalResponse { decision };
        self.send_server_request_response(request_id, &response).await?;
        Ok(())
    }

    async fn handle_apply_patch_approval(
        &mut self,
        request_id: RequestId,
        params: ApplyPatchApprovalParams,
        app: Option<&AppHandle>,
    ) -> Result<()> {
        info!(
            "apply_patch approval requested for conversation {} ({} files)",
            params.conversation_id,
            params.file_changes.len()
        );

        let (sender, receiver) = oneshot::channel();
        self.pending_patch_approvals
            .insert(request_id.clone(), sender);

        let payload = ApprovalRequestNotificationMessage::ApplyPatch {
            request_id: request_id.clone(),
            params,
        };
        if let Some(app) = app {
            app.emit(APPROVAL_REQUEST_TOPIC, &payload)
                .context("failed to emit apply patch approval request")?;
        }

        let decision = match receiver.await {
            Ok(decision) => decision,
            Err(_) => {
                warn!(
                    "apply_patch approval response receiver dropped for request {request_id:?}; defaulting to Denied"
                );
                let _ = self.pending_patch_approvals.remove(&request_id);
                ReviewDecision::Denied
            }
        };

        let response = ApplyPatchApprovalResponse { decision };
        self.send_server_request_response(request_id, &response).await?;
        Ok(())
    }

    async fn handle_file_change_request_approval(
        &mut self,
        request_id: RequestId,
        params: FileChangeRequestApprovalParams,
    ) -> Result<()> {
        info!(
            "file change approval requested for thread {}, turn {}, item {}",
            params.thread_id, params.turn_id, params.item_id
        );
        let response = FileChangeRequestApprovalResponse {
            decision: ApprovalDecision::Accept,
        };
        self.send_server_request_response(request_id, &response)
            .await?;
        Ok(())
    }

    pub(crate) fn respond_exec_approval(
        &mut self,
        request_id: RequestId,
        decision: ReviewDecision,
    ) -> Result<()> {
        let sender = self
            .pending_exec_approvals
            .remove(&request_id)
            .context("exec approval request not found")?;
        sender
            .send(decision)
            .map_err(|_| anyhow!("exec approval response receiver dropped"))?;
        Ok(())
    }

    pub(crate) fn respond_patch_approval(
        &mut self,
        request_id: RequestId,
        decision: ReviewDecision,
    ) -> Result<()> {
        let sender = self
            .pending_patch_approvals
            .remove(&request_id)
            .context("patch approval request not found")?;
        sender
            .send(decision)
            .map_err(|_| anyhow!("patch approval response receiver dropped"))?;
        Ok(())
    }

    async fn send_server_request_response<T>(
        &mut self,
        request_id: RequestId,
        response: &T,
    ) -> Result<()>
    where
        T: Serialize,
    {
        let message = JSONRPCMessage::Response(JSONRPCResponse {
            id: request_id,
            result: serde_json::to_value(response)?,
        });
        self.write_jsonrpc_message(message).await
    }

    async fn write_jsonrpc_message(&mut self, message: JSONRPCMessage) -> Result<()> {
        let payload = serde_json::to_string(&message)?;
        debug!("> {payload}");

        if let Some(stdin) = self.stdin.as_mut() {
            stdin
                .write_all(format!("{payload}\n").as_bytes())
                .await
                .context("failed to flush response to codex app-server")?;
            stdin.flush().await.context("failed to flush stdin")?;
            return Ok(());
        }

        bail!("codex app-server stdin closed")
    }
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub(super) enum ApprovalRequestNotificationMessage {
    ExecCommand {
        request_id: RequestId,
        params: ExecCommandApprovalParams,
    },
    ApplyPatch {
        request_id: RequestId,
        params: ApplyPatchApprovalParams,
    },
}
