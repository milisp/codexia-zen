import { create } from "zustand";

interface ActiveConversationState {
  activeConversationId: string | null;
  activeConversationIds: string[];
}

interface ActiveConversationActions {
  setActiveConversationId: (conversationId: string | null) => void;
}

export const useActiveConversationStore = create<
  ActiveConversationState & ActiveConversationActions
>()(
  (set) => ({
    activeConversationId: null,
    activeConversationIds: [],
    setActiveConversationId: (conversationId) =>
      set((state) => ({
        activeConversationId: conversationId,
        activeConversationIds:
          conversationId && !state.activeConversationIds.includes(conversationId)
            ? [...state.activeConversationIds, conversationId]
            : state.activeConversationIds,
      })),
  }),
);
