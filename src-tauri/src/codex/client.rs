use anyhow::{Context, Result, bail};
use codex_app_server_protocol::{
    ApprovalDecision, ClientInfo, ClientRequest, CommandExecutionRequestApprovalResponse,
    FileChangeRequestApprovalResponse, InitializeParams, InitializeResponse, JSONRPCMessage,
    JSONRPCRequest, JSONRPCResponse, RequestId, ServerNotification,
    ServerRequest,
};
use serde_json::Value;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::mpsc::{channel, Sender, Receiver};
use tauri::Emitter;
use uuid::Uuid;

use crate::codex::handles::{ClientCommand, CodexClientHandle};
use crate::codex::types::ApprovalRequest;
use crate::codex_discovery;

enum EventLoopMessage {
    Command(ClientCommand),
    JsonRpcMessage(JSONRPCMessage),
}

pub(crate) struct CodexClient {
    child: Child,
    stdin: ChildStdin,
    app_handle: tauri::AppHandle,
    pending_responses: HashMap<String, Sender<Result<Value>>>,
    event_rx: Receiver<EventLoopMessage>,
}

impl CodexClient {
    pub fn spawn_and_initialize(app_handle: tauri::AppHandle) -> Result<CodexClientHandle> {
        log::info!("CodexClient::spawn_and_initialize starting");
        let codex_bin = codex_discovery::discover_codex_command()
            .ok_or_else(|| anyhow::anyhow!("Unable to locate codex binary. Install Codex CLI"))?;
        let mut codex_app_server = Command::new(codex_bin)
            .arg("app-server")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .with_context(|| format!("failed to start codex app-server"))?;

        let stdin = codex_app_server
            .stdin
            .take()
            .context("codex app-server stdin unavailable")?;
        let stdout = codex_app_server
            .stdout
            .take()
            .context("codex app-server stdout unavailable")?;

        log::info!("Creating channels for client communication");
        let (command_tx, command_rx) = channel();
        let (event_tx, event_rx) = channel();

        // Spawn reader thread for stdout
        let event_tx_clone = event_tx.clone();
        let mut stdout_reader = BufReader::new(stdout);
        std::thread::spawn(move || {
            log::info!("Reader thread started");
            loop {
                log::debug!("Reader thread waiting for message from codex server...");
                match Self::read_jsonrpc_message_static(&mut stdout_reader) {
                    Ok(message) => {
                        log::info!("Reader thread received message: {:?}", message);
                        if event_tx_clone.send(EventLoopMessage::JsonRpcMessage(message)).is_err() {
                            log::info!("Event loop closed, reader thread exiting");
                            break;
                        }
                    }
                    Err(e) => {
                        log::error!("Reader thread error: {}", e);
                        break;
                    }
                }
            }
            log::info!("Reader thread exiting");
        });

        // Spawn command forwarder thread
        std::thread::spawn(move || {
            while let Ok(command) = command_rx.recv() {
                if event_tx.send(EventLoopMessage::Command(command)).is_err() {
                    break;
                }
            }
        });

        let mut client = Self {
            child: codex_app_server,
            stdin,
            app_handle,
            pending_responses: HashMap::new(),
            event_rx,
        };

        // Initialize the client synchronously
        log::info!("Initializing client (sending Initialize request)");
        client.initialize()?;
        log::info!("Client initialized successfully");

        // Spawn the event loop thread
        log::info!("Spawning event loop thread");
        std::thread::spawn(move || {
            log::info!("Event loop thread started");
            if let Err(e) = client.run_event_loop() {
                log::error!("Event loop error: {}", e);
            }
            log::info!("Event loop thread exiting");
        });

        log::info!("Returning CodexClientHandle");
        Ok(CodexClientHandle::new(command_tx))
    }

    fn initialize(&mut self) -> Result<InitializeResponse> {
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

        self.write_request(&request)?;
        self.wait_for_response_sync(&request_id)
    }

    fn run_event_loop(&mut self) -> Result<()> {
        loop {
            // Wait for events (blocking on the event channel)
            let event = self.event_rx.recv()
                .context("Event channel closed")?;

            match event {
                EventLoopMessage::Command(command) => {
                    log::info!("Event loop received command");
                    self.handle_command(command)?;
                }
                EventLoopMessage::JsonRpcMessage(message) => {
                    match message {
                        JSONRPCMessage::Notification(notification) => {
                            if let Ok(server_notification) = ServerNotification::try_from(notification.clone()) {
                                self.emit_notification(&server_notification)?;
                            }
                        }
                        JSONRPCMessage::Request(request) => {
                            self.handle_server_request(request)?;
                        }
                        JSONRPCMessage::Response(response) => {
                            self.handle_response(response)?;
                        }
                        JSONRPCMessage::Error(err) => {
                            self.handle_error_response(err)?;
                        }
                    }
                }
            }
        }
    }

    fn handle_command(&mut self, command: ClientCommand) -> Result<()> {
        match command {
            ClientCommand::ThreadStart { params, response_tx } => {
                log::info!("Handling ThreadStart command");
                let request_id = self.request_id();
                let id_str = match &request_id {
                    RequestId::String(s) => s.clone(),
                    RequestId::Integer(i) => i.to_string(),
                };
                log::info!("Generated request_id: {}", id_str);

                let request = ClientRequest::ThreadStart {
                    request_id: request_id.clone(),
                    params,
                };
                log::info!("Writing ThreadStart request to codex server");
                self.write_request(&request)?;
                log::info!("Registering response handler for request_id: {}", id_str);
                self.register_response_handler(request_id, response_tx);
            }
            ClientCommand::ThreadResume { params, response_tx } => {
                let request_id = self.request_id();
                let request = ClientRequest::ThreadResume {
                    request_id: request_id.clone(),
                    params,
                };
                self.write_request(&request)?;
                self.register_response_handler(request_id, response_tx);
            }
            ClientCommand::ThreadList { params, response_tx } => {
                let request_id = self.request_id();
                let request = ClientRequest::ThreadList {
                    request_id: request_id.clone(),
                    params,
                };
                self.write_request(&request)?;
                self.register_response_handler(request_id, response_tx);
            }
            ClientCommand::TurnStart { params, response_tx } => {
                let request_id = self.request_id();
                let request = ClientRequest::TurnStart {
                    request_id: request_id.clone(),
                    params,
                };
                self.write_request(&request)?;
                self.register_response_handler(request_id, response_tx);
            }
            ClientCommand::TurnInterrupt { params, response_tx } => {
                let request_id = self.request_id();
                let request = ClientRequest::TurnInterrupt {
                    request_id: request_id.clone(),
                    params,
                };
                self.write_request(&request)?;
                self.register_response_handler(request_id, response_tx);
            }
            ClientCommand::RespondToApproval {
                request_id,
                decision,
                is_command_execution,
            } => {
                self.send_approval_response(request_id, decision, is_command_execution)?;
            }
        }
        log::info!("Command handled successfully");
        Ok(())
    }

    fn register_response_handler<T>(&mut self, request_id: RequestId, response_tx: Sender<Result<T>>)
    where
        T: serde::de::DeserializeOwned + Send + 'static,
    {
        let id_str = match &request_id {
            RequestId::String(s) => s.clone(),
            RequestId::Integer(i) => i.to_string(),
        };

        // Create a wrapper that converts Value to T
        let (value_tx, value_rx) = channel();
        self.pending_responses.insert(id_str, value_tx);

        // Spawn a thread to deserialize and forward the response
        std::thread::spawn(move || {
            if let Ok(result) = value_rx.recv() {
                let typed_result = result.and_then(|value| {
                    serde_json::from_value(value).context("Failed to deserialize response")
                });
                let _ = response_tx.send(typed_result);
            }
        });
    }

    fn handle_response(&mut self, response: JSONRPCResponse) -> Result<()> {
        let id_str = match &response.id {
            RequestId::String(s) => s.clone(),
            RequestId::Integer(i) => i.to_string(),
        };

        log::info!("Received response for request_id: {}", id_str);

        if let Some(tx) = self.pending_responses.remove(&id_str) {
            log::info!("Found pending response handler, sending response");
            let _ = tx.send(Ok(response.result));
        } else {
            log::warn!("No pending response handler found for request_id: {}", id_str);
        }
        Ok(())
    }

    fn handle_error_response(&mut self, err: codex_app_server_protocol::JSONRPCError) -> Result<()> {
        let id_str = match &err.id {
            RequestId::String(s) => s.clone(),
            RequestId::Integer(i) => i.to_string(),
        };

        log::error!("Received error response for request_id: {}: {:?}", id_str, err);

        if let Some(tx) = self.pending_responses.remove(&id_str) {
            let _ = tx.send(Err(anyhow::anyhow!("Request failed: {:?}", err)));
        }
        Ok(())
    }

    fn emit_notification(&self, notification: &ServerNotification) -> Result<()> {
        let event_name = format!("codex:{}", notification.to_string());
        log::info!("Emitting event: {} with payload: {:?}", event_name, notification);
        self.app_handle
            .emit("codex:notification", notification)
            .context("failed to emit notification")?;
        Ok(())
    }

    fn handle_server_request(&mut self, request: JSONRPCRequest) -> Result<()> {
        let server_request = ServerRequest::try_from(request)
            .context("failed to deserialize ServerRequest")?;

        match server_request {
            ServerRequest::CommandExecutionRequestApproval { request_id, params } => {
                let request_id_str = match &request_id {
                    RequestId::String(s) => s.clone(),
                    RequestId::Integer(i) => i.to_string(),
                };

                let approval_request = ApprovalRequest {
                    request_id: request_id_str,
                    thread_id: params.thread_id.clone(),
                    turn_id: params.turn_id.clone(),
                    item_id: params.item_id.clone(),
                    reason: params.reason.clone(),
                    kind: crate::codex::types::ApprovalRequestKind::CommandExecution {
                        proposed_execpolicy_amendment: params
                            .proposed_execpolicy_amendment
                            .map(|a| a.command),
                    },
                };

                // Emit approval request to frontend
                self.app_handle
                    .emit("codex://approval-request", &approval_request)
                    .context("failed to emit approval request")?;
            }
            ServerRequest::FileChangeRequestApproval { request_id, params } => {
                let request_id_str = match &request_id {
                    RequestId::String(s) => s.clone(),
                    RequestId::Integer(i) => i.to_string(),
                };

                let approval_request = ApprovalRequest {
                    request_id: request_id_str,
                    thread_id: params.thread_id.clone(),
                    turn_id: params.turn_id.clone(),
                    item_id: params.item_id.clone(),
                    reason: params.reason.clone(),
                    kind: crate::codex::types::ApprovalRequestKind::FileChange {
                        grant_root: params.grant_root.map(|p| p.display().to_string()),
                    },
                };

                // Emit approval request to frontend
                self.app_handle
                    .emit("codex://approval-request", &approval_request)
                    .context("failed to emit approval request")?;
            }
            _ => {
                bail!("received unsupported server request: {:?}", server_request);
            }
        }

        Ok(())
    }

    fn send_approval_response(
        &mut self,
        request_id: RequestId,
        decision: ApprovalDecision,
        is_command_execution: bool,
    ) -> Result<()> {
        let message = if is_command_execution {
            JSONRPCMessage::Response(JSONRPCResponse {
                id: request_id,
                result: serde_json::to_value(CommandExecutionRequestApprovalResponse {
                    decision,
                })?,
            })
        } else {
            JSONRPCMessage::Response(JSONRPCResponse {
                id: request_id,
                result: serde_json::to_value(FileChangeRequestApprovalResponse { decision })?,
            })
        };

        self.write_jsonrpc_message(message)
    }

    fn wait_for_response_sync<T>(&mut self, request_id: &RequestId) -> Result<T>
    where
        T: serde::de::DeserializeOwned,
    {
        loop {
            let event = self.event_rx.recv()
                .context("Event channel closed during initialization")?;

            match event {
                EventLoopMessage::JsonRpcMessage(message) => {
                    match message {
                        JSONRPCMessage::Response(response) => {
                            if &response.id == request_id {
                                return serde_json::from_value(response.result)
                                    .context("Failed to deserialize response");
                            }
                        }
                        JSONRPCMessage::Error(err) => {
                            if &err.id == request_id {
                                bail!("Request failed: {:?}", err);
                            }
                        }
                        JSONRPCMessage::Notification(notification) => {
                            if let Ok(server_notification) = ServerNotification::try_from(notification) {
                                let _ = self.emit_notification(&server_notification);
                            }
                        }
                        JSONRPCMessage::Request(request) => {
                            let _ = self.handle_server_request(request);
                        }
                    }
                }
                EventLoopMessage::Command(_) => {
                    // Ignore commands during initialization
                }
            }
        }
    }

    fn write_request(&mut self, request: &ClientRequest) -> Result<()> {
        let request_json = serde_json::to_string(request)?;
        writeln!(self.stdin, "{}", request_json)?;
        self.stdin.flush().context("failed to flush request")?;
        Ok(())
    }

    fn read_jsonrpc_message_static(stdout: &mut BufReader<ChildStdout>) -> Result<JSONRPCMessage> {
        loop {
            let mut response_line = String::new();
            let bytes = stdout
                .read_line(&mut response_line)
                .context("failed to read from codex app-server")?;

            if bytes == 0 {
                bail!("codex app-server closed stdout");
            }

            let trimmed = response_line.trim();
            if trimmed.is_empty() {
                continue;
            }

            let parsed: Value =
                serde_json::from_str(trimmed).context("response was not valid JSON")?;
            let message: JSONRPCMessage =
                serde_json::from_value(parsed).context("response was not valid JSON-RPC message")?;
            return Ok(message);
        }
    }

    fn write_jsonrpc_message(&mut self, message: JSONRPCMessage) -> Result<()> {
        let payload = serde_json::to_string(&message)?;
        writeln!(self.stdin, "{}", payload)?;
        self.stdin.flush().context("failed to flush response")?;
        Ok(())
    }

    fn request_id(&self) -> RequestId {
        RequestId::String(Uuid::new_v4().to_string())
    }
}

impl Drop for CodexClient {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
