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

      set((state) => ({
        eventsByConversationId: {
          ...state.eventsByConversationId,
          [conversationId]: [
            ...(state.eventsByConversationId[conversationId] ?? []),
            params,
          ],
        },
      }));
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
