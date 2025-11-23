import { create } from "zustand";
import type { StreamedEventNotification } from "@/types";

interface EventStoreState {
  eventsByConversationId: Record<string, StreamedEventNotification["params"][]>;
  setConversationEvents: (
    conversationId: string,
    events: StreamedEventNotification["params"][],
  ) => void;
  appendEvent: (params: StreamedEventNotification["params"]) => void;
  clearConversationEvents: (conversationId: string) => void;
}

export const useEventStore = create<EventStoreState>()(
  (set) => ({
    eventsByConversationId: {},
    setConversationEvents: (conversationId, events) =>
      set((state) => ({
        eventsByConversationId: {
          ...state.eventsByConversationId,
          [conversationId]: events,
        },
      })),
    appendEvent: (params) => {
      const conversationId = params.conversationId;
      if (!conversationId) {
        return;
      }

      set((state) => {
        const conversationEvents = state.eventsByConversationId[conversationId] ?? [];
        const { msg } = params;

        const mergeWithPrevious = (
          predicate: (event: StreamedEventNotification["params"]) => boolean,
        ) => {
          const previousIndex = conversationEvents.findLastIndex(predicate);
          if (previousIndex === -1) {
            return null;
          }

          const previousEvent = conversationEvents[previousIndex];
          if (!("delta" in previousEvent.msg) || typeof previousEvent.msg.delta !== "string") {
            return null;
          }

          const deltaString =
            "delta" in msg && typeof msg.delta === "string"
              ? msg.delta
              : undefined;
          if (deltaString === undefined) {
            return null;
          }

          const mergedDelta = `${previousEvent.msg.delta}${deltaString}`;
          const updatedEvent: StreamedEventNotification["params"] = {
            ...previousEvent,
            msg: {
              ...previousEvent.msg,
              delta: mergedDelta,
            },
          };
          const nextEvents = [...conversationEvents];
          nextEvents[previousIndex] = updatedEvent;
          return nextEvents;
        };

        let nextEvents = null;
        if (msg.type === "reasoning_content_delta" && "item_id" in msg) {
          nextEvents = mergeWithPrevious(
            (event) =>
              event.msg.type === "reasoning_content_delta" &&
              "item_id" in event.msg &&
              event.msg.item_id === msg.item_id,
          );
        } else if (msg.type === "agent_reasoning_delta") {
          nextEvents = mergeWithPrevious(
            (event) => event.msg.type === "agent_reasoning_delta",
          );
        } else if (
          msg.type === "agent_message_content_delta" &&
          "item_id" in msg
        ) {
          nextEvents = mergeWithPrevious(
            (event) =>
              event.msg.type === "agent_message_content_delta" &&
              "item_id" in event.msg &&
              event.msg.item_id === msg.item_id,
          );
        }

        if (nextEvents) {
          return {
            eventsByConversationId: {
              ...state.eventsByConversationId,
              [conversationId]: nextEvents,
            },
          };
        }

        return {
          eventsByConversationId: {
            ...state.eventsByConversationId,
            [conversationId]: [...conversationEvents, params],
          },
        };
      });
    },
    clearConversationEvents: (conversationId) =>
      set((state) => {
        if (!state.eventsByConversationId[conversationId]) {
          return state;
        }

        return {
          eventsByConversationId: {
            ...state.eventsByConversationId,
            [conversationId]: [],
          },
        };
      }),
  }),
);
