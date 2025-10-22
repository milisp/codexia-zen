import { create } from "zustand";
import type { ConversationEvent, EventWithId } from "@/types/chat";
import { DELTA_EVENT_TYPES } from "@/types/chat";

interface ConversationState {
  eventsByConversation: Record<string, ConversationEvent[]>;
  currentMessage: string;
}

interface ConversationActions {
  setCurrentMessage: (value: string) => void;
  appendEvent: (conversationId: string, event: EventWithId) => void;
  replaceEvents: (conversationId: string, events: ConversationEvent[]) => void;
  clearConversation: (conversationId: string) => void;
  reset: () => void;
}

export const useConversationStore = create<
  ConversationState & ConversationActions
>()((set) => ({
  eventsByConversation: {},
  currentMessage: "",
  setCurrentMessage: (value) => set({ currentMessage: value }),
  appendEvent: (conversationId, event) => {
    if (DELTA_EVENT_TYPES.has(event.msg.type)) {
      return;
    }
    set((state) => {
      const existing = state.eventsByConversation[conversationId] ?? [];
      return {
        eventsByConversation: {
          ...state.eventsByConversation,
          [conversationId]: [...existing, event],
        },
      };
    });
  },
  replaceEvents: (conversationId, events) =>
    set((state) => ({
      eventsByConversation: {
        ...state.eventsByConversation,
        [conversationId]: events.filter(
          (event) => !DELTA_EVENT_TYPES.has(event.msg.type),
        ),
      },
    })),
  clearConversation: (conversationId) =>
    set((state) => {
      const updated = { ...state.eventsByConversation };
      delete updated[conversationId];
      return { eventsByConversation: updated };
    }),
  reset: () => set({ eventsByConversation: {}, currentMessage: "" }),
}));
