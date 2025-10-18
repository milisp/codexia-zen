use serde::{Deserialize, Serialize};
use serde::de::DeserializeOwned;
use serde_json::Value;
use std::{collections::HashMap, sync::Arc};
use tauri_plugin_log::log::{error, info};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::Command,
    sync::{Mutex, broadcast, mpsc},
};
use uuid::Uuid;
use codex_app_server_protocol::{
    AddConversationListenerParams, AddConversationSubscriptionResponse, ClientInfo,
    InitializeParams, InitializeResponse, InputItem, NewConversationParams,
    NewConversationResponse, SendUserMessageParams,
};
use codex_protocol::ConversationId;
use codex_protocol::protocol::{ErrorEvent, EventMsg};

use crate::codex_discovery::discover_codex_command;

const CODEX_APP_SERVER_ARGS: &[&str] = &["app-server"];

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Params {
    pub id: String,
    pub msg: EventMsg,
    pub conversation_id: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Line {
    pub method: String,
    pub params: Params,
}

#[derive(Clone)]
pub struct CodexClient {
    stdin_tx: mpsc::Sender<String>,
    event_tx: broadcast::Sender<Line>,
    request_map: Arc<Mutex<HashMap<String, mpsc::Sender<Value>>>>,
}

impl CodexClient {
    pub fn new(api_key: String, env_key: String) -> Self {
        let (stdin_tx, stdin_rx) = mpsc::channel(100);
        let (event_tx, _) = broadcast::channel(100);
        let request_map = Arc::new(Mutex::new(HashMap::new()));

        tokio::spawn(Self::run_app_server_process(
            stdin_rx,
            event_tx.clone(),
            api_key,
            env_key,
            request_map.clone(),
        ));

        Self {
            stdin_tx,
            event_tx,
            request_map,
        }
    }

    async fn run_app_server_process(
        mut stdin_rx: mpsc::Receiver<String>,
        event_tx: broadcast::Sender<Line>,
        api_key: String,
        env_key: String,
        request_map: Arc<Mutex<HashMap<String, mpsc::Sender<Value>>>>,
    ) {
        let mut envs = HashMap::new();
        if !api_key.is_empty() {
            envs.insert(
                env_key,
                api_key,
            );
        }

        let codex_command = match discover_codex_command() {
            Some(path) => path,
            None => {
                error!("Failed to discover codex app-server command.");
                return;
            }
        };

        let mut child = match Command::new(&codex_command)
            .args(CODEX_APP_SERVER_ARGS)
            .envs(envs)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::inherit()) // For debugging codex process errors
            .spawn()
        {
            Ok(child) => child,
            Err(e) => {
                error!("Failed to spawn codex app-server: {}", e);
                // Emit an error event to the frontend
                let _ = event_tx.send(Line {
                    method: "error".to_string(),
                    params: Params {
                        id: Uuid::new_v4().to_string(),
                        msg: EventMsg::Error(ErrorEvent {
                            message: format!("Failed to start codex app-server. Error: {}", e),
                        }),
                        conversation_id: "".to_string(),
                    },
                });
                return;
            }
        };

        let mut stdin = child.stdin.take().unwrap();
        let stdout = BufReader::new(child.stdout.take().unwrap());
        let mut lines = stdout.lines();

        loop {
            tokio::select! {
                line_result = lines.next_line() => {
                    match line_result {
                        Ok(Some(line)) => {
                            if let Ok(json_value) = serde_json::from_str::<Value>(&line) {
                                let is_response = if let Some(id) = json_value.get("id").and_then(|v| v.as_str()) {
                                    let mut map = request_map.lock().await;
                                    if let Some(tx) = map.remove(id) {
                                        let _ = tx.send(json_value.clone()).await;
                                        true
                                    } else {
                                        false
                                    }
                                } else {
                                    false
                                };

                                if !is_response {
                                    if let Ok(event_line) = serde_json::from_value::<Line>(json_value.clone()) {
                                        let _ = event_tx.send(event_line);
                                    } else {
                                        println!("Failed to parse JSON into Line struct: {}", line);
                                    }
                                }
                            } else {
                                println!("Received non-JSON line from codex: {}", line);
                            }
                        },
                        Ok(None) => {
                            info!("Codex app-server stdout stream ended.");
                            break;
                        },
                        Err(e) => {
                            error!("Error reading from codex app-server stdout: {}", e);
                            break;
                        }
                    }
                },
                Some(msg) = stdin_rx.recv() => {
                    if let Err(e) = stdin.write_all(msg.as_bytes()).await {
                        error!("Failed to write to codex stdin: {}", e);
                        break;
                    }
                    if let Err(e) = stdin.write_all(b"\n").await {
                        error!("Failed to write newline to codex stdin: {}", e);
                        break;
                    }
                    if let Err(e) = stdin.flush().await {
                        error!("Failed to flush codex stdin: {}", e);
                        break;
                    }
                },
                else => break,
            }
        }

        info!("Codex app-server process loop finished.");
    }

    pub async fn send_request<R: DeserializeOwned>(
        &self,
        method: &str,
        params: Value,
    ) -> anyhow::Result<R> {
        let id = Uuid::new_v4().to_string();
        let request = serde_json::json!({
            "id": id.clone(),
            "method": method,
            "params": params,
        })
        .to_string();

        let (tx, mut rx) = mpsc::channel(1);
        {
            let mut map = self.request_map.lock().await;
            map.insert(id, tx);
        }

        self.stdin_tx.send(request).await?;

        let response = rx
            .recv()
            .await
            .ok_or_else(|| anyhow::anyhow!("Request channel closed before response"))?;
        println!("Raw response from codex app-server: {:?}", response);

        if let Some(error) = response.get("error") {
            return Err(anyhow::anyhow!("App server error: {:?}", error));
        }

        let result_value = response
            .get("result")
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("App server response missing 'result' field"))?;

        serde_json::from_value(result_value)
            .map_err(|e| anyhow::anyhow!("Failed to parse app server response result: {}", e))
    }

    pub fn subscribe_to_events(&self) -> broadcast::Receiver<Line> {
        self.event_tx.subscribe()
    }

    // --- Protocol Methods ---

    pub async fn initialize(&self) -> anyhow::Result<InitializeResponse> {
        let params = InitializeParams {
            client_info: ClientInfo {
                name: "codexia-zen".to_string(),
                version: "0.1.0".to_string(),
                title: Some("Codexia Zen".to_string()),
            },
        };
        self.send_request("initialize", serde_json::to_value(params)?)
            .await
    }

    pub async fn new_conversation(
        &self,
        params: NewConversationParams,
    ) -> anyhow::Result<NewConversationResponse> {
        self.send_request("newConversation", serde_json::to_value(params)?)
            .await
    }

    pub async fn add_conversation_listener(
        &self,
        conversation_id: ConversationId,
    ) -> anyhow::Result<AddConversationSubscriptionResponse> {
        let params = AddConversationListenerParams { conversation_id };
        self.send_request("addConversationListener", serde_json::to_value(params)?)
            .await
    }

    pub async fn send_user_message(
        &self,
        conversation_id: ConversationId,
        items: Vec<InputItem>,
    ) -> anyhow::Result<serde_json::Value> {
        let params = SendUserMessageParams {
            conversation_id,
            items,
        };
        self.send_request("sendUserMessage", serde_json::to_value(params)?)
            .await
    }

    pub async fn send_response_to_server_request<R: Serialize>(
        &self,
        request_id: i64,
        result: R,
    ) -> anyhow::Result<()> {
        let response = serde_json::json!({
            "id": request_id,
            "result": result,
        })
        .to_string();

        self.stdin_tx.send(response).await?;
        Ok(())
    }
}
