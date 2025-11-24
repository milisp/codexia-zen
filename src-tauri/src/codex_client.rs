use std::collections::{HashMap, VecDeque};
use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;

use crate::state::ClientState;
use anyhow::{anyhow, bail, Context, Result};
use codex_app_server_protocol::{
    AddConversationListenerParams, AddConversationSubscriptionResponse, ApplyPatchApprovalParams,
    ApplyPatchApprovalResponse, ApprovalDecision, ClientInfo, ClientRequest,
    CommandExecutionRequestAcceptSettings, CommandExecutionRequestApprovalParams,
    CommandExecutionRequestApprovalResponse, ExecCommandApprovalParams,
    ExecCommandApprovalResponse, FileChangeRequestApprovalParams,
    FileChangeRequestApprovalResponse, InitializeParams, InputItem, JSONRPCMessage,
    JSONRPCNotification, JSONRPCRequest, JSONRPCResponse, NewConversationParams,
    NewConversationResponse, RequestId, SendUserMessageParams, ServerNotification, ServerRequest,
    ThreadListParams, ThreadListResponse, ThreadResumeParams, ThreadResumeResponse,
    ThreadStartParams, ThreadStartResponse, TurnStartParams, TurnStartResponse, UserInput,
};
use codex_protocol::ConversationId;
use codex_protocol::protocol::{Event, EventMsg, ReviewDecision};
use log::{debug, info, warn};
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use uuid::Uuid;

const EVENT_TOPIC: &str = "codex://notification";
const RAW_EVENT_TOPIC: &str = "codex://raw-notification";
const CONVERSATION_EVENT_TOPIC: &str = "codex://conversation-event";
const APPROVAL_REQUEST_TOPIC: &str = "codex://approval-request";

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ApprovalRequestNotificationMessage {
    ExecCommand {
        request_id: RequestId,
        params: ExecCommandApprovalParams,
    },
    ApplyPatch {
        request_id: RequestId,
        params: ApplyPatchApprovalParams,
    },
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TurnHandles {
    pub thread_id: String,
    pub turn_id: String,
}

#[derive(Default)]
pub struct CodexClientManager {
    state: ClientState,
}

impl CodexClientManager {
    pub async fn initialize(&self) -> Result<()> {
        self.state
            .with_ready_client(|_client| Box::pin(async { Ok(()) }))
            .await
    }

    pub async fn new_conversation(
        &self,
        params: NewConversationParams,
    ) -> Result<NewConversationResponse> {
        self.state
            .with_ready_client(|client| {
                Box::pin(async move { client.new_conversation(params).await })
            })
            .await
    }

    pub async fn add_conversation_listener(
        &self,
        conversation_id: ConversationId,
    ) -> Result<AddConversationSubscriptionResponse> {
        self.state
            .with_ready_client(|client| {
                Box::pin(async move { client.add_conversation_listener(&conversation_id).await })
            })
            .await
    }

    pub async fn send_user_message(
        &self,
        app: AppHandle,
        conversation_id: ConversationId,
        message: String,
    ) -> Result<()> {
        self.state
            .with_ready_client(|client| {
                Box::pin(async move {
                    client.send_user_message(&conversation_id, &message).await?;
                    client.stream_conversation(&app, &conversation_id).await
                })
            })
            .await
    }

    pub async fn respond_exec_approval(
        &self,
        request_id: RequestId,
        decision: ReviewDecision,
    ) -> Result<()> {
        self.state
            .with_ready_client(|client| {
                Box::pin(async move { client.respond_exec_approval(request_id, decision) })
            })
            .await
    }

    pub async fn respond_patch_approval(
        &self,
        request_id: RequestId,
        decision: ReviewDecision,
    ) -> Result<()> {
        self.state
            .with_ready_client(|client| {
                Box::pin(async move { client.respond_patch_approval(request_id, decision) })
            })
            .await
    }

    pub async fn list_threads(&self, params: ThreadListParams) -> Result<ThreadListResponse> {
        self.state
            .with_ready_client(|client| Box::pin(async move { client.thread_list(params).await }))
            .await
    }

    pub async fn resume_thread(&self, params: ThreadResumeParams) -> Result<ThreadResumeResponse> {
        self.state
            .with_ready_client(|client| Box::pin(async move { client.thread_resume(params).await }))
            .await
    }

    pub async fn start_turn(
        &self,
        app: AppHandle,
        prompt: String,
        cwd: Option<String>,
    ) -> Result<TurnHandles> {
        self.state
            .with_ready_client(|client| {
                Box::pin(async move {
                    let thread_response = client
                        .thread_start(ThreadStartParams {
                            cwd: cwd.clone(),
                            ..Default::default()
                        })
                        .await?;

                    let turn_response = client
                        .turn_start(TurnStartParams {
                            thread_id: thread_response.thread.id.clone(),
                            input: vec![UserInput::Text { text: prompt }],
                            cwd: cwd.clone().map(PathBuf::from),
                            ..Default::default()
                        })
                        .await?;

                    let thread_id = thread_response.thread.id.clone();
                    let turn_id = turn_response.turn.id.clone();

                    client
                        .stream_turn(&app, &thread_id, &turn_id)
                        .await
                        .context("failed while streaming turn")?;

                    Ok(TurnHandles { thread_id, turn_id })
                })
            })
            .await
    }
}

pub(crate) struct CodexClient {
    child: Child,
    stdin: Option<ChildStdin>,
    stdout: BufReader<ChildStdout>,
    pending_notifications: VecDeque<JSONRPCNotification>,
    initialized: bool,
    pending_exec_approvals: HashMap<RequestId, oneshot::Sender<ReviewDecision>>,
    pending_patch_approvals: HashMap<RequestId, oneshot::Sender<ReviewDecision>>,
}

impl CodexClient {
    pub(crate) async fn spawn(codex_bin: String) -> Result<Self> {
        let mut child = Command::new(&codex_bin)
            .arg("app-server")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .with_context(|| format!("failed to start `{codex_bin}` app-server"))?;

        let stdin = child
            .stdin
            .take()
            .context("codex app-server stdin unavailable")?;
        let stdout = child
            .stdout
            .take()
            .context("codex app-server stdout unavailable")?;

        Ok(Self {
            child,
            stdin: Some(stdin),
            stdout: BufReader::new(stdout),
            pending_notifications: VecDeque::new(),
            initialized: false,
            pending_exec_approvals: HashMap::new(),
            pending_patch_approvals: HashMap::new(),
        })
    }

    pub(crate) async fn ensure_initialized(&mut self) -> Result<()> {
        if !self.initialized {
            self.initialize().await?;
        }
        Ok(())
    }

    async fn initialize(&mut self) -> Result<()> {
        let request_id = self.request_id();
        let request = ClientRequest::Initialize {
            request_id: request_id.clone(),
            params: InitializeParams {
                client_info: ClientInfo {
                    name: "codexia-zen".to_string(),
                    title: Some("Codexia Zen".to_string()),
                    version: env!("CARGO_PKG_VERSION").to_string(),
                },
            },
        };

        let response: Value = self.send_request(request, request_id, "initialize").await?;
        debug!("initialize response: {response:?}");
        self.initialized = true;
        Ok(())
    }

    async fn new_conversation(
        &mut self,
        params: NewConversationParams,
    ) -> Result<NewConversationResponse> {
        let request_id = self.request_id();
        let request = ClientRequest::NewConversation {
            request_id: request_id.clone(),
            params,
        };

        self.send_request(request, request_id, "newConversation")
            .await
    }

    async fn add_conversation_listener(
        &mut self,
        conversation_id: &ConversationId,
    ) -> Result<AddConversationSubscriptionResponse> {
        let request_id = self.request_id();
        let request = ClientRequest::AddConversationListener {
            request_id: request_id.clone(),
            params: AddConversationListenerParams {
                conversation_id: *conversation_id,
                experimental_raw_events: false,
            },
        };
        self.send_request(request, request_id, "addConversationListener")
            .await
    }

    async fn send_user_message(
        &mut self,
        conversation_id: &ConversationId,
        message: &str,
    ) -> Result<()> {
        let request_id = self.request_id();
        let request = ClientRequest::SendUserMessage {
            request_id: request_id.clone(),
            params: SendUserMessageParams {
                conversation_id: *conversation_id,
                items: vec![InputItem::Text {
                    text: message.to_string(),
                }],
            },
        };

        let _: Value = self
            .send_request(request, request_id, "sendUserMessage")
            .await?;
        Ok(())
    }

    async fn thread_start(&mut self, params: ThreadStartParams) -> Result<ThreadStartResponse> {
        let request_id = self.request_id();
        let request = ClientRequest::ThreadStart {
            request_id: request_id.clone(),
            params,
        };

        self.send_request(request, request_id, "thread/start").await
    }

    async fn thread_list(&mut self, params: ThreadListParams) -> Result<ThreadListResponse> {
        let request_id = self.request_id();
        let request = ClientRequest::ThreadList {
            request_id: request_id.clone(),
            params,
        };

        self.send_request(request, request_id, "thread/list").await
    }

    async fn thread_resume(&mut self, params: ThreadResumeParams) -> Result<ThreadResumeResponse> {
        let request_id = self.request_id();
        let request = ClientRequest::ThreadResume {
            request_id: request_id.clone(),
            params,
        };

        self.send_request(request, request_id, "thread/resume")
            .await
    }

    async fn turn_start(&mut self, params: TurnStartParams) -> Result<TurnStartResponse> {
        let request_id = self.request_id();
        let request = ClientRequest::TurnStart {
            request_id: request_id.clone(),
            params,
        };

        self.send_request(request, request_id, "turn/start").await
    }

    async fn stream_turn(&mut self, app: &AppHandle, thread_id: &str, turn_id: &str) -> Result<()> {
        loop {
            let notification = self.next_notification(Some(app)).await?;

            if let Ok(server_notification) = ServerNotification::try_from(notification.clone()) {
                app.emit(EVENT_TOPIC, &server_notification)
                    .context("failed to emit server notification to frontend")?;

                match &server_notification {
                    ServerNotification::ThreadStarted(payload) => {
                        if payload.thread.id == thread_id {
                            info!("thread {} started", payload.thread.id);
                        }
                    }
                    ServerNotification::TurnStarted(payload) => {
                        if payload.turn.id == turn_id {
                            info!("turn {} started", payload.turn.id);
                        }
                    }
                    ServerNotification::TurnCompleted(payload) => {
                        if payload.turn.id == turn_id {
                            info!(
                                "turn {} completed with status {:?}",
                                payload.turn.id, payload.turn.status
                            );
                            break;
                        }
                    }
                    _ => {}
                }

                continue;
            }

            // Unknown notification shape; forward raw payload for debugging.
            app.emit(RAW_EVENT_TOPIC, &notification)
                .context("failed to emit raw notification")?;
        }

        Ok(())
    }

    async fn stream_conversation(
        &mut self,
        app: &AppHandle,
        conversation_id: &ConversationId,
    ) -> Result<()> {
        loop {
            let notification = self.next_notification(Some(app)).await?;

            if !notification.method.starts_with("codex/event/") {
                continue;
            }

            if let Some(event) = self.extract_event(&notification, conversation_id)? {
                let event_msg = event.msg.clone();
                app.emit(CONVERSATION_EVENT_TOPIC, &notification)
                    .context("failed to emit conversation event")?;

                match event_msg {
                    EventMsg::TaskComplete(_) | EventMsg::TurnAborted(_) => break,
                    _ => {}
                }
            }
        }
        Ok(())
    }

    fn extract_event(
        &self,
        notification: &JSONRPCNotification,
        conversation_id: &ConversationId,
    ) -> Result<Option<Event>> {
        let params = notification
            .params
            .as_ref()
            .context("event notification missing params")?;

        let mut map = match params.clone() {
            Value::Object(map) => map,
            other => bail!("unexpected params shape: {other:?}"),
        };

        let conversation_value = map
            .remove("conversationId")
            .context("event missing conversationId")?;
        let notification_conversation: ConversationId = serde_json::from_value(conversation_value)
            .context("conversationId was not a valid UUID")?;

        if &notification_conversation != conversation_id {
            return Ok(None);
        }

        let event_value = Value::Object(map);
        let event: Event =
            serde_json::from_value(event_value).context("failed to decode event payload")?;
        Ok(Some(event))
    }

    async fn send_request<T>(
        &mut self,
        request: ClientRequest,
        request_id: RequestId,
        method: &str,
    ) -> Result<T>
    where
        T: DeserializeOwned,
    {
        self.write_request(&request).await?;
        self.wait_for_response(request_id, method).await
    }

    async fn write_request(&mut self, request: &ClientRequest) -> Result<()> {
        let request_json = serde_json::to_string(request)?;
        let request_pretty = serde_json::to_string_pretty(request)?;
        debug!("> {request_pretty}");

        if let Some(stdin) = self.stdin.as_mut() {
            stdin
                .write_all(format!("{request_json}\n").as_bytes())
                .await
                .context("failed to write request to codex app-server")?;
            stdin
                .flush()
                .await
                .context("failed to flush request to codex app-server")?;
        } else {
            bail!("codex app-server stdin closed");
        }

        Ok(())
    }

    async fn wait_for_response<T>(&mut self, request_id: RequestId, method: &str) -> Result<T>
    where
        T: DeserializeOwned,
    {
        loop {
            let message = self.read_jsonrpc_message().await?;

            match message {
                JSONRPCMessage::Response(JSONRPCResponse { id, result }) => {
                    if id == request_id {
                        return serde_json::from_value(result)
                            .with_context(|| format!("{method} response missing payload"));
                    }
                }
                JSONRPCMessage::Error(err) => {
                    if err.id == request_id {
                        bail!("{method} failed: {err:?}");
                    }
                }
                JSONRPCMessage::Notification(notification) => {
                    self.pending_notifications.push_back(notification);
                }
                JSONRPCMessage::Request(request) => {
                    self.handle_server_request(request, None).await?;
                }
            }
        }
    }

    async fn next_notification(
        &mut self,
        app: Option<&AppHandle>,
    ) -> Result<JSONRPCNotification> {
        if let Some(notification) = self.pending_notifications.pop_front() {
            return Ok(notification);
        }

        loop {
            let message = self.read_jsonrpc_message().await?;

            match message {
                JSONRPCMessage::Notification(notification) => return Ok(notification),
                JSONRPCMessage::Response(_) | JSONRPCMessage::Error(_) => {
                    continue;
                }
                JSONRPCMessage::Request(request) => {
                    self.handle_server_request(request, app).await?;
                }
            }
        }
    }

    async fn read_jsonrpc_message(&mut self) -> Result<JSONRPCMessage> {
        loop {
            let mut response_line = String::new();
            let bytes = self
                .stdout
                .read_line(&mut response_line)
                .await
                .context("failed to read from codex app-server")?;

            if bytes == 0 {
                bail!("codex app-server closed stdout");
            }

            let trimmed = response_line.trim();
            if trimmed.is_empty() {
                continue;
            }

            let parsed: Value =
                serde_json::from_str(trimmed).context("response was not valid JSON-RPC")?;
            debug!("< {:#}", parsed);
            let message: JSONRPCMessage = serde_json::from_value(parsed)
                .context("response was not a valid JSON-RPC message")?;
            return Ok(message);
        }
    }

    fn request_id(&self) -> RequestId {
        RequestId::String(Uuid::new_v4().to_string())
    }

    async fn handle_server_request(
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

    fn respond_exec_approval(
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

    fn respond_patch_approval(
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

impl Drop for CodexClient {
    fn drop(&mut self) {
        let _ = self.stdin.take();

        if let Ok(Some(status)) = self.child.try_wait() {
            warn!("codex app-server exited early: {status}");
            return;
        }

        std::thread::sleep(Duration::from_millis(100));

        if let Ok(Some(status)) = self.child.try_wait() {
            warn!("codex app-server exited: {status}");
            return;
        }

        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
