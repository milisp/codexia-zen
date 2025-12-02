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
        let request = ClientRequest::NewConversation {
            request_id: self.request_id(),
            params,
        };

        self.send_request(request, "newConversation").await
    }

    pub(crate) async fn add_conversation_listener(
        &mut self,
        conversation_id: &ConversationId,
    ) -> Result<AddConversationSubscriptionResponse> {
        let request = ClientRequest::AddConversationListener {
            request_id: self.request_id(),
            params: AddConversationListenerParams {
                conversation_id: *conversation_id,
                experimental_raw_events: false,
            },
        };
        self.send_request(request, "addConversationListener")
            .await
    }

    pub(crate) async fn send_user_message(
        &mut self,
        conversation_id: &ConversationId,
        message: &str,
    ) -> Result<()> {
        let request = ClientRequest::SendUserMessage {
            request_id: self.request_id(),
            params: SendUserMessageParams {
                conversation_id: *conversation_id,
                items: vec![InputItem::Text {
                    text: message.to_string(),
                }],
            },
        };

        let _: Value = self
            .send_request(request, "sendUserMessage")
            .await?;
        Ok(())
    }

    pub(crate) async fn turn_interrupt(
        &mut self,
        thread_id: &ConversationId,
        turn_id: &str,
    ) -> Result<TurnInterruptResponse> {
        let request = ClientRequest::TurnInterrupt {
            request_id: self.request_id(),
            params: TurnInterruptParams {
                thread_id: thread_id.to_string(),
                turn_id: turn_id.to_string(),
            },
        };

        self.send_request(request, "turn/interrupt").await
    }

    pub(crate) async fn thread_start(&mut self, params: ThreadStartParams) -> Result<ThreadStartResponse> {
        let request = ClientRequest::ThreadStart {
            request_id: self.request_id(),
            params,
        };

        self.send_request(request, "thread/start").await
    }

    pub(crate) async fn thread_resume(&mut self, params: ThreadResumeParams) -> Result<ThreadResumeResponse> {
        let request = ClientRequest::ThreadResume {
            request_id: self.request_id(),
            params,
        };

        self.send_request(request, "thread/resume").await
    }

    pub(crate) async fn turn_start(&mut self, params: TurnStartParams) -> Result<TurnStartResponse> {
        let request = ClientRequest::TurnStart {
            request_id: self.request_id(),
            params,
        };

        self.send_request(request, "turn/start").await
    }
}
