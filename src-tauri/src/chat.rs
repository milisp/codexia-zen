use std::process::Stdio;
use std::sync::Arc;

use chrono::Utc;
use serde::Deserialize;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewWindow};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStderr, ChildStdin, ChildStdout, Command};
use tokio::sync::Mutex;
use uuid::Uuid;

const CODEX_EVENT: &str = "codex-event";

#[derive(Debug, Clone, Default)]
pub struct ChatState {
    inner: Arc<ChatStateInner>,
}

#[derive(Debug, Default)]
struct ChatStateInner {
    session: Mutex<Option<Arc<ChatSession>>>,
    config_overrides: Mutex<Vec<String>>,
}

#[derive(Debug)]
struct ChatSession {
    id: Uuid,
    stdin: Arc<Mutex<ChildStdin>>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum CodexEvent {
    SessionConfigured {
        timestamp: String,
    },
    UserMessage {
        id: String,
        message: String,
        timestamp: String,
    },
    AgentMessageDelta {
        id: String,
        delta: String,
        timestamp: String,
    },
    AgentMessage {
        id: String,
        message: String,
        timestamp: String,
    },
    TaskStarted {
        id: String,
        timestamp: String,
    },
    TaskComplete {
        id: String,
        timestamp: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        last_agent_message: Option<String>,
    },
    TurnDiff {
        id: String,
        unified_diff: String,
        timestamp: String,
    },
    Error {
        #[serde(skip_serializing_if = "Option::is_none")]
        id: Option<String>,
        message: String,
        timestamp: String,
    },
    ProcessExited {
        timestamp: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<i32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        signal: Option<i32>,
    },
    Log {
        level: String,
        message: String,
        timestamp: String,
    },
}

#[derive(Debug, Serialize)]
struct Submission {
    id: String,
    op: SubmissionOp,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum SubmissionOp {
    UserInput { items: Vec<InputItem> },
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum InputItem {
    Text { text: String },
}

#[derive(Debug, Deserialize)]
pub struct SendRequest {
    pub prompt: String,
    #[serde(default)]
    pub config_overrides: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct SendResponse {
    pub submission_id: String,
    pub timestamp: String,
}

#[derive(Debug, Deserialize)]
pub struct InitRequest {
    #[serde(default)]
    pub config_overrides: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct StartRequest {
    #[serde(default)]
    pub config_overrides: Option<Vec<String>>,
}

impl ChatState {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn init<R: Runtime>(
        &self,
        _app: &AppHandle<R>,
        req: InitRequest,
    ) -> Result<(), String> {
        if let Some(overrides) = req.config_overrides {
            let mut guard = self.inner.config_overrides.lock().await;
            *guard = overrides;
        }
        Ok(())
    }

    pub async fn start<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        req: StartRequest,
    ) -> Result<(), String> {
        if let Some(overrides) = req.config_overrides {
            let mut guard = self.inner.config_overrides.lock().await;
            *guard = overrides;
        }

        if self.current_session().await.is_some() {
            return Ok(());
        }

        let overrides = {
            let guard = self.inner.config_overrides.lock().await;
            if guard.is_empty() {
                vec!["preset=chatbox".to_string()]
            } else {
                guard.clone()
            }
        };

        let session = ChatSession::spawn(app, overrides, self.inner.clone()).await?;
        {
            let mut guard = self.inner.session.lock().await;
            *guard = Some(session);
        }
        Ok(())
    }

    pub async fn send<R: Runtime>(
        &self,
        _app: &AppHandle<R>,
        prompt: String,
        overrides: Option<Vec<String>>,
    ) -> Result<SendResponse, String> {
        if let Some(list) = overrides {
            let mut guard = self.inner.config_overrides.lock().await;
            *guard = list;
        }

        let session = self
            .current_session()
            .await
            .ok_or_else(|| "chat session has not been started".to_string())?;
        let submission_id = Uuid::new_v4();
        let submission = Submission {
            id: submission_id.to_string(),
            op: SubmissionOp::UserInput {
                items: vec![InputItem::Text { text: prompt }],
            },
        };
        session.send(submission).await?;

        Ok(SendResponse {
            submission_id: submission_id.to_string(),
            timestamp: Utc::now().to_rfc3339(),
        })
    }

    async fn current_session(&self) -> Option<Arc<ChatSession>> {
        let guard = self.inner.session.lock().await;
        guard.as_ref().cloned()
    }
}

impl ChatSession {
    async fn spawn<R: Runtime>(
        app: &AppHandle<R>,
        overrides: Vec<String>,
        state: Arc<ChatStateInner>,
    ) -> Result<Arc<Self>, String> {
        let window = app
            .get_webview_window("main")
            .ok_or_else(|| "main window not found".to_string())?;

        println!("over rides {:?}", overrides);

        let mut command = Command::new("codex");
        command.arg("app-server");

        for override_pair in overrides {
            command.arg("-c").arg(override_pair);
        }
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = command
            .spawn()
            .map_err(|err| format!("failed to spawn codex: {err}"))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "codex stdin unavailable".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "codex stdout unavailable".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "codex stderr unavailable".to_string())?;

        let child_arc = Arc::new(Mutex::new(Some(child)));
        let session_id = Uuid::new_v4();
        let session = Arc::new(ChatSession {
            id: session_id,
            stdin: Arc::new(Mutex::new(stdin)),
        });

        spawn_stdout_reader(stdout, window.clone(), state.clone(), session_id);
        spawn_stderr_reader(stderr, window.clone());
        spawn_wait_task(child_arc, window, state, session_id);

        Ok(session)
    }

    async fn send(&self, submission: Submission) -> Result<(), String> {
        let mut stdin = self.stdin.lock().await;
        let payload = serde_json::to_string(&submission)
            .map_err(|err| format!("failed to serialize submission: {err}"))?;
        stdin
            .write_all(payload.as_bytes())
            .await
            .map_err(|err| format!("failed to write submission: {err}"))?;
        stdin
            .write_all(b"\n")
            .await
            .map_err(|err| format!("failed to write newline: {err}"))?;
        stdin
            .flush()
            .await
            .map_err(|err| format!("failed to flush submission: {err}"))?;
        Ok(())
    }
}

fn spawn_stdout_reader<R: Runtime>(
    stdout: ChildStdout,
    window: WebviewWindow<R>,
    state: Arc<ChatStateInner>,
    session_id: Uuid,
) {
    tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            match serde_json::from_str::<serde_json::Value>(trimmed) {
                Ok(value) => handle_event(&window, &value),
                Err(err) => emit_event(
                    &window,
                    CodexEvent::Log {
                        level: "error".to_string(),
                        message: format!("failed to parse event: {err}: {trimmed}"),
                        timestamp: Utc::now().to_rfc3339(),
                    },
                ),
            }
        }
        emit_event(
            &window,
            CodexEvent::Log {
                level: "info".to_string(),
                message: "codex stdout closed".to_string(),
                timestamp: Utc::now().to_rfc3339(),
            },
        );
        state.clear_session_by_id(session_id).await;
    });
}

fn spawn_stderr_reader<R: Runtime>(stderr: ChildStderr, window: WebviewWindow<R>) {
    tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            emit_event(
                &window,
                CodexEvent::Log {
                    level: "stderr".to_string(),
                    message: line,
                    timestamp: Utc::now().to_rfc3339(),
                },
            );
        }
    });
}

fn spawn_wait_task<R: Runtime>(
    child_arc: Arc<Mutex<Option<Child>>>,
    window: WebviewWindow<R>,
    state: Arc<ChatStateInner>,
    session_id: Uuid,
) {
    tauri::async_runtime::spawn(async move {
        let status = {
            let mut guard = child_arc.lock().await;
            if let Some(mut child) = guard.take() {
                child.wait().await
            } else {
                return;
            }
        };

        match status {
            Ok(exit_status) => {
                #[cfg(unix)]
                let signal = std::os::unix::process::ExitStatusExt::signal(&exit_status);
                #[cfg(not(unix))]
                let signal = None;

                emit_event(
                    &window,
                    CodexEvent::ProcessExited {
                        code: exit_status.code(),
                        signal,
                        timestamp: Utc::now().to_rfc3339(),
                    },
                );
            }
            Err(err) => {
                emit_event(
                    &window,
                    CodexEvent::Log {
                        level: "error".to_string(),
                        message: format!("failed waiting for codex: {err}"),
                        timestamp: Utc::now().to_rfc3339(),
                    },
                );
            }
        }
        state.clear_session_by_id(session_id).await;
    });
}

fn handle_event<R: Runtime>(window: &WebviewWindow<R>, value: &serde_json::Value) {
    let id = value
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();
    let msg = match value.get("msg") {
        Some(msg) => msg,
        None => {
            emit_event(
                window,
                CodexEvent::Log {
                    level: "warn".to_string(),
                    message: format!("missing msg field in event: {value}"),
                    timestamp: Utc::now().to_rfc3339(),
                },
            );
            return;
        }
    };

    let msg_type = msg.get("type").and_then(|v| v.as_str()).unwrap_or_default();

    match msg_type {
        "session_configured" => emit_event(
            window,
            CodexEvent::SessionConfigured {
                timestamp: Utc::now().to_rfc3339(),
            },
        ),
        "user_message" => {
            let message = msg
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            emit_event(
                window,
                CodexEvent::UserMessage {
                    id,
                    message,
                    timestamp: Utc::now().to_rfc3339(),
                },
            );
        }
        "agent_message_delta" => {
            let delta = msg
                .get("delta")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            emit_event(
                window,
                CodexEvent::AgentMessageDelta {
                    id,
                    delta,
                    timestamp: Utc::now().to_rfc3339(),
                },
            );
        }
        "agent_message" => {
            let message = msg
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            emit_event(
                window,
                CodexEvent::AgentMessage {
                    id,
                    message,
                    timestamp: Utc::now().to_rfc3339(),
                },
            );
        }
        "task_started" => emit_event(
            window,
            CodexEvent::TaskStarted {
                id,
                timestamp: Utc::now().to_rfc3339(),
            },
        ),
        "task_complete" => {
            let last_agent_message = msg
                .get("last_agent_message")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            emit_event(
                window,
                CodexEvent::TaskComplete {
                    id,
                    last_agent_message,
                    timestamp: Utc::now().to_rfc3339(),
                },
            );
        }
        "turn_diff" => {
            let unified_diff = msg
                .get("unified_diff")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            emit_event(
                window,
                CodexEvent::TurnDiff {
                    id,
                    unified_diff,
                    timestamp: Utc::now().to_rfc3339(),
                },
            );
        }
        "error" => {
            let message = msg
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            emit_event(
                window,
                CodexEvent::Error {
                    id: if id.is_empty() { None } else { Some(id) },
                    message,
                    timestamp: Utc::now().to_rfc3339(),
                },
            );
        }
        other => emit_event(
            window,
            CodexEvent::Log {
                level: "debug".to_string(),
                message: format!("ignoring event type: {other}"),
                timestamp: Utc::now().to_rfc3339(),
            },
        ),
    }
}

fn emit_event<R: Runtime>(window: &WebviewWindow<R>, event: CodexEvent) {
    if let Err(err) = window.emit(CODEX_EVENT, event) {
        eprintln!("failed to emit chatbox event: {err}");
    }
}

impl ChatStateInner {
    async fn clear_session_by_id(&self, session_id: Uuid) {
        let mut guard = self.session.lock().await;
        if guard
            .as_ref()
            .map(|session| session.id == session_id)
            .unwrap_or(false)
        {
            *guard = None;
        }
    }
}
