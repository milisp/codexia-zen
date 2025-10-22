import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ConversationSummary {
  conversationId: string;
  preview: string;
  path?: string | null;
  timestamp?: string | null;
}

interface ConversationListState {
  conversationsByCwd: Record<string, ConversationSummary[]>;
  conversationIndex: Record<string, string>;
  activeConversationId: string | null;
}

interface ConversationListActions {
  setActiveConversationId: (conversationId: string | null) => void;
  addConversation: (cwd: string, summary: ConversationSummary) => void;
  updateConversationPreview: (conversationId: string, preview: string) => void;
  updateConversationPath: (conversationId: string, path: string | null) => void;
  removeConversation: (conversationId: string) => void;
  reset: () => void;
}

export const useConversationListStore = create<
  ConversationListState & ConversationListActions
>()(
  persist(
    (set, get) => ({
      conversationsByCwd: {},
      conversationIndex: {},
      activeConversationId: null,

      setActiveConversationId: (conversationId) =>
        set({ activeConversationId: conversationId }),

      addConversation: (cwd, summary) =>
        set((state) => {
          const existingList = state.conversationsByCwd[cwd] ?? [];
          const index = existingList.findIndex(
            (item) => item.conversationId === summary.conversationId,
          );
          const nextList =
            index >= 0
              ? existingList.map((item, idx) =>
                  idx === index ? { ...item, ...summary } : item,
                )
              : [...existingList, summary];

          return {
            conversationsByCwd: {
              ...state.conversationsByCwd,
              [cwd]: nextList,
            },
            conversationIndex: {
              ...state.conversationIndex,
              [summary.conversationId]: cwd,
            },
          };
        }),

      updateConversationPreview: (conversationId, preview) => {
        const cwd = get().conversationIndex[conversationId];
        if (!cwd) return;
        set((state) => {
          const list = state.conversationsByCwd[cwd] ?? [];
          const nextList = list.map((item) =>
            item.conversationId === conversationId
              ? { ...item, preview }
              : item,
          );
          return {
            conversationsByCwd: {
              ...state.conversationsByCwd,
              [cwd]: nextList,
            },
          };
        });
      },

      updateConversationPath: (conversationId, path) => {
        const cwd = get().conversationIndex[conversationId];
        if (!cwd) return;
        set((state) => {
          const list = state.conversationsByCwd[cwd] ?? [];
          const nextList = list.map((item) =>
            item.conversationId === conversationId
              ? { ...item, path }
              : item,
          );
          return {
            conversationsByCwd: {
              ...state.conversationsByCwd,
              [cwd]: nextList,
            },
          };
        });
      },

      removeConversation: (conversationId) => {
        const cwd = get().conversationIndex[conversationId];
        if (!cwd) return;
        set((state) => {
          const list = state.conversationsByCwd[cwd] ?? [];
          const nextList = list.filter(
            (item) => item.conversationId !== conversationId,
          );
          const nextIndex = { ...state.conversationIndex };
          delete nextIndex[conversationId];

          const shouldClearActive =
            state.activeConversationId === conversationId;

          return {
            conversationsByCwd: {
              ...state.conversationsByCwd,
              [cwd]: nextList,
            },
            conversationIndex: nextIndex,
            activeConversationId: shouldClearActive
              ? null
              : state.activeConversationId,
          };
        });
      },

      reset: () =>
        set({
          conversationsByCwd: {},
          conversationIndex: {},
          activeConversationId: null,
        }),
    }),
    {
      name: "conversation-list",
    },
  ),
);
