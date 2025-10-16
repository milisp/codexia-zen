import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ConversationSummary } from "@/bindings/ConversationSummary";

interface ConversationStore {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  setConversations: (conversations: ConversationSummary[]) => void;
  setActiveConversationId: (id: string | null) => void;
  addConversation: (conversation: ConversationSummary) => void;
  selectConversation: (id: string) => void;
}

export const useConversationStore = create<ConversationStore>()(
  persist(
    (set) => ({
      conversations: [],
      activeConversationId: null,
      setConversations: (conversations) => set({ conversations }),
      setActiveConversationId: (id) => set({ activeConversationId: id }),
      addConversation: (conversation) =>
        set((state) => ({
          conversations: [...state.conversations, conversation],
        })),
      selectConversation: (id: string) => {
        set({ activeConversationId: id });
      },
    }),
    {
      name: "conversation"
    },
  ),
);
