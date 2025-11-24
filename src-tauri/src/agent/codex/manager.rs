use std::path::PathBuf;

use anyhow::{Context, Result};
use codex_app_server_protocol::{
    AddConversationSubscriptionResponse, NewConversationParams, NewConversationResponse, RequestId,
    ThreadResumeParams, ThreadResumeResponse,
    ThreadStartParams, TurnInterruptResponse, TurnStartParams, UserInput,
};
use codex_protocol::protocol::ReviewDecision;
use codex_protocol::ConversationId;
use log::{error, info};
use tauri::AppHandle;

use crate::state::ClientState;

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

    pub async fn turn_interrupt(
        &self,
        thread_id: ConversationId,
        turn_id: String,
    ) -> Result<TurnInterruptResponse> {
        let thread_id_clone = thread_id.clone();
        self.state
            .with_ready_client(move |client| {
                let turn_id_clone = turn_id.clone();
                Box::pin(async move {
                    info!(
                        "requesting turn interrupt for thread {thread_id_clone} turn {turn_id_clone}"
                    );
                    match client
                        .turn_interrupt(&thread_id_clone, turn_id_clone.as_str())
                        .await
                    {
                        Ok(response) => {
                            info!(
                                "turn interrupt success for thread {thread_id_clone} turn {turn_id_clone}"
                            );
                            Ok(response)
                        }
                        Err(err) => {
                            error!(
                                "turn interrupt failed for thread {thread_id_clone} turn {turn_id_clone}: {err}"
                            );
                            Err(err)
                        }
                    }
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
