import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ConversationSummary } from "@/bindings/ConversationSummary";

interface ConversationStore {
  conversationsByCwd: Record<string, ConversationSummary[]>;
  activeConversationId: string | null;
  setConversations: (cwd: string, conversations: ConversationSummary[]) => void;
  setActiveConversationId: (id: string | null) => void;
  addConversation: (cwd: string, conversation: ConversationSummary) => void;
}

export const useConversationStore = create<ConversationStore>()(
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
    }),
    {
      name: "conversation",
    },
  ),
);
