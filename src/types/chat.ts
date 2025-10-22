import type { EventMsg } from "@/bindings/EventMsg";

export interface ConversationEventPayload {
  method: string;
  params: {
    conversationId?: string;
    id?: string;
    msg?: EventMsg;
    [key: string]: unknown;
  } | null;
}

export interface EventWithId {
  id: string;
  msg: EventMsg;
}

export type ConversationEvent = EventWithId;

export const DELTA_EVENT_TYPES = new Set<EventMsg["type"]>([
  "agent_message_delta",
  "agent_reasoning_delta",
  "agent_reasoning_raw_content_delta",
]);
