import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ConversationSummary } from "@/bindings/ConversationSummary";

interface ConversationListStore {
  conversationsByCwd: Record<string, ConversationSummary[]>;
  activeConversationId: string | null;
  setConversations: (cwd: string, conversations: ConversationSummary[]) => void;
  setActiveConversationId: (id: string | null) => void;
  addConversation: (cwd: string, conversation: ConversationSummary) => void;
  removeConversation: (conversationId: string) => void;
}

export const useConversationListStore = create<ConversationListStore>()(
  persist(
    (set) => ({
      conversationsByCwd: {},
      activeConversationId: null,
      setConversations: (cwd, conversations) =>
        set((state) => ({
          conversationsByCwd: {
            ...state.conversationsByCwd,
            [cwd]: conversations,
          },
        })),
      setActiveConversationId: (id) => set({ activeConversationId: id }),
      addConversation: (cwd, conversation) =>
        set((state) => ({
          conversationsByCwd: {
            ...state.conversationsByCwd,
            [cwd]: [...(state.conversationsByCwd[cwd] || []), conversation],
          },
        })),
      removeConversation: (conversationId) =>
        set((state) => ({
          conversationsByCwd: Object.fromEntries(
            Object.entries(state.conversationsByCwd).map(([cwd, conversations]) => [
              cwd,
              conversations.filter((conv) => conv.conversationId !== conversationId),
            ]),
          ),
          activeConversationId:
            state.activeConversationId === conversationId
              ? null
              : state.activeConversationId,
        })),
    }),
    {
      name: "conversation-list",
    },
  ),
);
