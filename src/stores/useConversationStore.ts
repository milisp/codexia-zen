import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ConversationSummary } from "@/bindings/ConversationSummary";

export type Conversation = ConversationSummary & { sessionId: string };

interface ConversationStore {
  conversationsByCwd: Record<string, Conversation[]>;
  activeConversationId: string | null;
  setConversations: (cwd: string, conversations: Conversation[]) => void;
  setActiveConversationId: (id: string | null) => void;
  addConversation: (cwd: string, conversation: Conversation) => void;
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
