use anyhow::{bail, Context, Result};
use codex_app_server_protocol::{JSONRPCNotification, ServerNotification};
use codex_protocol::protocol::{Event, EventMsg};
use codex_protocol::ConversationId;
use log::info;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use super::{CodexClient, CONVERSATION_EVENT_TOPIC, EVENT_TOPIC, RAW_EVENT_TOPIC, TURN_EVENT_TOPIC};

impl CodexClient {
    pub(crate) async fn stream_turn(&mut self, app: &AppHandle, thread_id: &str, turn_id: &str) -> Result<()> {
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

    pub(crate) async fn stream_conversation(
        &mut self,
        app: &AppHandle,
        conversation_id: &ConversationId,
    ) -> Result<()> {
        loop {
            let notification = self.next_notification(Some(app)).await?;

            if let Ok(server_notification) = ServerNotification::try_from(notification.clone()) {
                match server_notification {
                    ServerNotification::TurnStarted(payload) => {
                        app.emit(
                            TURN_EVENT_TOPIC,
                            &json!({
                                "conversationId": conversation_id.to_string(),
                                "turnId": payload.turn.id,
                            }),
                        )
                        .context("failed to emit turn event to frontend")?;
                    }
                    _ => {}
                }
            }

            if !notification.method.starts_with("codex/event/") {
                continue;
            }

            if let Some(event) = self.extract_event(&notification, conversation_id)? {
                let event_msg = event.msg.clone();
                app.emit(CONVERSATION_EVENT_TOPIC, &notification)
                    .context("failed to emit conversation event")?;
                info!(
                    "conversation-event {} -> {:?}",
                    conversation_id, event_msg
                );

                match event_msg {
                    EventMsg::TaskComplete(_) => break,
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
}
