import { create } from "zustand";
import { Message } from "@/types/Message";
import { ConversationSummary } from "@/bindings/ConversationSummary";

type ChatState = {
  // Conversations
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>; // Store messages per conversationId
  currentMessage: string;
};

type ChatActions = {
  // Conversations
  setConversations: (conversations: ConversationSummary[]) => void;
  setActiveConversationId: (conversationId: string | null) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateLastAgentMessage: (conversationId: string, delta: string) => void;
  clearMessages: (conversationId: string) => void;
  setCurrentMessage: (message: string) => void;
};

export const useChatStore = create<ChatState & ChatActions>()((set, get) => ({
  // Initial State
  conversations: [],
  activeConversationId: null,
  messages: {},

  currentMessage: "",

  // Actions
  setConversations: (conversations) => set({ conversations }),
  setActiveConversationId: (conversationId) =>
    set({ activeConversationId: conversationId }),

  addMessage: (conversationId, message) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] || []), message],
      },
    }));
  },

  updateLastAgentMessage: (conversationId, delta) => {
    const messages = get().messages[conversationId] || [];
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "agent") {
        const updatedMessage = {
          ...lastMessage,
          text: lastMessage.content + delta,
        };
        const newMessages = [...messages.slice(0, -1), updatedMessage];
        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: newMessages,
          },
        }));
        return;
      }
    }
    // If no agent message to update, add a new one
    get().addMessage(conversationId, {
      id: Date.now().toString() + "-agent-delta",
      role: delta,
      content: "agent",
      timestamp: Date.now(),
    });
  },

  clearMessages: (conversationId: string) => {
    set((state) => {
      const newMessages = { ...state.messages };
      delete newMessages[conversationId];
      return { messages: newMessages };
    });
  },
  setCurrentMessage: (message) => set({ currentMessage: message }),
}));
