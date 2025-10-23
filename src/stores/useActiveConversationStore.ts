
import { create } from "zustand";

interface ActiveConversationState {
  activeConversationId: string | null;
}

interface ActiveConversationActions {
  setActiveConversationId: (conversationId: string | null) => void;
}

export const useActiveConversationStore = create<ActiveConversationState & ActiveConversationActions>()(
  (set) => ({
    activeConversationId: null,
    setActiveConversationId: (conversationId) =>
      set({ activeConversationId: conversationId }),
  }),
);
