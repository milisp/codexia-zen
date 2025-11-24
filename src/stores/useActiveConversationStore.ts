import { create } from "zustand";

interface ActiveConversationState {
  activeConversationId: string | null;
  activeConversationIds: string[];
  busyConversations: Record<string, boolean>;
  currentTurnIds: Record<string, string | null>;
}

interface ActiveConversationActions {
  setActiveConversationId: (conversationId: string | null) => void;
  setConversationBusy: (conversationId: string, value: boolean) => void;
  setCurrentTurnId: (conversationId: string, turnId: string | null) => void;
}

export const useActiveConversationStore = create<
  ActiveConversationState & ActiveConversationActions
>()(
  (set) => ({
    activeConversationId: null,
    activeConversationIds: [],
    busyConversations: {},
    currentTurnIds: {},
    setActiveConversationId: (conversationId) =>
      set((state) => ({
        activeConversationId: conversationId,
        activeConversationIds:
          conversationId && !state.activeConversationIds.includes(conversationId)
            ? [...state.activeConversationIds, conversationId]
            : state.activeConversationIds,
      })),
    setConversationBusy: (conversationId, value) =>
      set((state) => {
        const nextBusy = { ...state.busyConversations };
        if (value) {
          nextBusy[conversationId] = true;
        } else {
          delete nextBusy[conversationId];
        }
        return {
          busyConversations: nextBusy,
        };
      }),
    setCurrentTurnId: (conversationId, turnId) =>
      set((state) => {
        const nextTurns = { ...state.currentTurnIds };
        if (turnId === null) {
          delete nextTurns[conversationId];
        } else {
          nextTurns[conversationId] = turnId;
        }
        return {
          currentTurnIds: nextTurns,
        };
      }),
  }),
);
