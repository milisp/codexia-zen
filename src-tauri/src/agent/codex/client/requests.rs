use anyhow::Result;
use codex_app_server_protocol::{
    AddConversationListenerParams, AddConversationSubscriptionResponse, ClientRequest, InputItem,
    NewConversationParams, NewConversationResponse, SendUserMessageParams, ThreadResumeParams,
    ThreadResumeResponse, ThreadStartParams,
    ThreadStartResponse, TurnInterruptParams, TurnInterruptResponse, TurnStartParams,
    TurnStartResponse,
};
use codex_protocol::ConversationId;
use serde_json::Value;

use super::CodexClient;

impl CodexClient {
    pub(crate) async fn new_conversation(
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

    pub(crate) async fn add_conversation_listener(
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

    pub(crate) async fn send_user_message(
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

    pub(crate) async fn turn_interrupt(
        &mut self,
        thread_id: &ConversationId,
        turn_id: &str,
    ) -> Result<TurnInterruptResponse> {
        let request_id = self.request_id();
        let request = ClientRequest::TurnInterrupt {
            request_id: request_id.clone(),
            params: TurnInterruptParams {
                thread_id: thread_id.to_string(),
                turn_id: turn_id.to_string(),
            },
        };

        self.send_request(request, request_id, "turn/interrupt")
            .await
    }

    pub(crate) async fn thread_start(&mut self, params: ThreadStartParams) -> Result<ThreadStartResponse> {
        let request_id = self.request_id();
        let request = ClientRequest::ThreadStart {
            request_id: request_id.clone(),
            params,
        };

        self.send_request(request, request_id, "thread/start").await
    }

    pub(crate) async fn thread_resume(&mut self, params: ThreadResumeParams) -> Result<ThreadResumeResponse> {
        let request_id = self.request_id();
        let request = ClientRequest::ThreadResume {
            request_id: request_id.clone(),
            params,
        };

        self.send_request(request, request_id, "thread/resume")
            .await
    }

    pub(crate) async fn turn_start(&mut self, params: TurnStartParams) -> Result<TurnStartResponse> {
        let request_id = self.request_id();
        let request = ClientRequest::TurnStart {
            request_id: request_id.clone(),
            params,
        };

        self.send_request(request, request_id, "turn/start").await
    }
}
