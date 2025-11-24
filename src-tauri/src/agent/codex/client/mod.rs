use std::collections::{HashMap, VecDeque};
use std::process::Stdio;
use std::time::Duration;

use anyhow::{bail, Context, Result};
use codex_app_server_protocol::{
    ClientInfo, ClientRequest, InitializeParams, JSONRPCMessage, JSONRPCNotification,
    JSONRPCResponse, RequestId,
};
use codex_protocol::protocol::ReviewDecision;
use log::{debug, warn};
use serde::de::DeserializeOwned;
use serde_json::{self, Value};
use tauri::AppHandle;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::oneshot;
use uuid::Uuid;


mod handlers;
mod requests;
mod streams;

const EVENT_TOPIC: &str = "codex://notification";
const RAW_EVENT_TOPIC: &str = "codex://raw-notification";
const CONVERSATION_EVENT_TOPIC: &str = "codex://conversation-event";
const TURN_EVENT_TOPIC: &str = "codex://turn-event";
const APPROVAL_REQUEST_TOPIC: &str = "codex://approval-request";

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
                        match serde_json::from_value::<T>(result.clone()) {
                            Ok(value) => return Ok(value),
                            Err(primary_err) => {
                                if let Some(payload) =
                                    result.get("payload").or_else(|| result.get("result"))
                                {
                                    if let Ok(value) =
                                        serde_json::from_value::<T>(payload.clone())
                                    {
                                        warn!(
                                            "{method} response wrapped in payload; using nested payload"
                                        );
                                        return Ok(value);
                                    }
                                }

                                                                let raw_result = serde_json::to_string(&result)
                                    .unwrap_or_else(|_| "<unprintable>".to_string());
                                warn!(
                                    "{method} response could not be deserialized: {primary_err}; raw result: {raw_result}"
                                );
                                return Err(primary_err).with_context(|| {
                                    format!("{method} response missing payload; raw result: {raw_result}")
                                });
                            }
                        }
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
