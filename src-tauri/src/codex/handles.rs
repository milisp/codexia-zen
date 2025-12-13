use anyhow::{Context, Result};
use codex_app_server_protocol::{
    ApprovalDecision, RequestId, ThreadResumeParams, ThreadResumeResponse,
    ThreadStartParams, ThreadStartResponse, TurnInterruptParams, TurnInterruptResponse,
    TurnStartParams, TurnStartResponse, ThreadListParams, ThreadListResponse,
};
use std::sync::mpsc::{channel, Sender};

// Commands that can be sent to the client thread
pub(crate) enum ClientCommand {
    ThreadStart {
        params: ThreadStartParams,
        response_tx: Sender<Result<ThreadStartResponse>>,
    },
    ThreadResume {
        params: ThreadResumeParams,
        response_tx: Sender<Result<ThreadResumeResponse>>,
    },
    ThreadList {
        params: ThreadListParams,
        response_tx: Sender<Result<ThreadListResponse>>,
    },
    TurnStart {
        params: TurnStartParams,
        response_tx: Sender<Result<TurnStartResponse>>,
    },
    TurnInterrupt {
        params: TurnInterruptParams,
        response_tx: Sender<Result<TurnInterruptResponse>>,
    },
    RespondToApproval {
        request_id: RequestId,
        decision: ApprovalDecision,
        is_command_execution: bool,
    },
}

// Handle for communicating with the client thread
pub struct CodexClientHandle {
    command_tx: Sender<ClientCommand>,
}

impl Drop for CodexClientHandle {
    fn drop(&mut self) {
        log::info!("CodexClientHandle is being dropped");
    }
}

impl CodexClientHandle {
    pub fn spawn_and_initialize(app_handle: tauri::AppHandle) -> Result<Self> {
        log::info!("CodexClientHandle::spawn_and_initialize called");
        let handle = crate::codex::client::CodexClient::spawn_and_initialize(app_handle)?;
        log::info!("CodexClientHandle created successfully");
        Ok(handle)
    }

    pub fn thread_start(&self, params: ThreadStartParams) -> Result<ThreadStartResponse> {
        let (response_tx, response_rx) = channel();
        self.command_tx
            .send(ClientCommand::ThreadStart { params, response_tx })
            .context("Failed to send thread_start command")?;
        response_rx
            .recv()
            .context("Failed to receive thread_start response")?
    }

    pub fn thread_resume(&self, params: ThreadResumeParams) -> Result<ThreadResumeResponse> {
        let (response_tx, response_rx) = channel();
        self.command_tx
            .send(ClientCommand::ThreadResume { params, response_tx })
            .context("Failed to send thread_resume command")?;
        response_rx
            .recv()
            .context("Failed to receive thread_resume response")?
    }

    pub fn thread_list(&self, params: ThreadListParams) -> Result<ThreadListResponse> {
        let (response_tx, response_rx) = channel();
        self.command_tx
            .send(ClientCommand::ThreadList { params, response_tx })
            .context("Failed to send thread_list command")?;
        response_rx
            .recv()
            .context("Failed to receive thread_list response")?
    }

    pub fn turn_start(&self, params: TurnStartParams) -> Result<TurnStartResponse> {
        let (response_tx, response_rx) = channel();
        self.command_tx
            .send(ClientCommand::TurnStart { params, response_tx })
            .context("Failed to send turn_start command")?;
        response_rx
            .recv()
            .context("Failed to receive turn_start response")?
    }

    pub fn turn_interrupt(&self, params: TurnInterruptParams) -> Result<TurnInterruptResponse> {
        let (response_tx, response_rx) = channel();
        self.command_tx
            .send(ClientCommand::TurnInterrupt { params, response_tx })
            .context("Failed to send turn_interrupt command")?;
        response_rx
            .recv()
            .context("Failed to receive turn_interrupt response")?
    }

    pub fn respond_to_approval(
        &self,
        request_id: RequestId,
        decision: ApprovalDecision,
        is_command_execution: bool,
    ) -> Result<()> {
        self.command_tx
            .send(ClientCommand::RespondToApproval {
                request_id,
                decision,
                is_command_execution,
            })
            .context("Failed to send respond_to_approval command")?;
        Ok(())
    }
}

// Internal constructor for CodexClient to create handles
impl CodexClientHandle {
    pub(crate) fn new(command_tx: Sender<ClientCommand>) -> Self {
        Self { command_tx }
    }
}

