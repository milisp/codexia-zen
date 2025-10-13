import { create } from "zustand";
import { Message } from "@/types/Message";
import { ConversationSummary } from "@/bindings/ConversationSummary";
import { EventMsg } from "@/bindings/EventMsg";

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
  updateLastAgentMessage: (conversationId: string, event: EventMsg) => void;
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

  updateLastAgentMessage: (conversationId, event) => {
    const messages = get().messages[conversationId] || [];
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant") {
        let newContent = lastMessage.content || "";
        if (event.type === "agent_message_delta") {
          newContent += event.delta;
        } else if (event.type === "agent_message") {
          newContent = event.message;
        } else if (event.type === "task_complete" && event.last_agent_message) {
          newContent = event.last_agent_message;
        }

        const updatedMessage = {
          ...lastMessage,
          content: newContent,
          events: [...(lastMessage.events || []), event],
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
    // If no agent message to update, add a new one with the event
    let initialContent = "";
    if (event.type === "agent_message_delta") {
      initialContent = event.delta;
    } else if (event.type === "agent_message") {
      initialContent = event.message;
    } else if (event.type === "task_complete" && event.last_agent_message) {
      initialContent = event.last_agent_message;
    }

    get().addMessage(conversationId, {
      id: Date.now().toString() + "-agent-event",
      role: "assistant",
      content: initialContent,
      timestamp: Date.now(),
      events: [event],
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
