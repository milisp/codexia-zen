import { create } from "zustand";
import { ConversationSummary } from "@/bindings/ConversationSummary";
import { EventMsg } from "@/bindings/EventMsg";
import { Message } from "@/types";
import { EventWithId } from "@/types/Message";

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
  updateLastAgentMessage: (conversationId: string, event: EventWithId) => void;
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

  updateLastAgentMessage: (conversationId: string, event: { id: string, msg: EventMsg }) => {
    const messages = get().messages[conversationId] || [];
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant") {
        let newContent = lastMessage.content || "";
        if (event.msg.type === "agent_message_delta") {
          newContent += event.msg.delta;
        } else if (event.msg.type === "agent_message") {
          newContent = event.msg.message;
        } else if (event.msg.type === "agent_reasoning_raw_content") {
          newContent = event.msg.text;
        } else if (event.msg.type === "agent_reasoning_raw_content_delta") {
          newContent = event.msg.delta;
        } else if (event.msg.type === "task_complete" && event.msg.last_agent_message) {
          newContent = event.msg.last_agent_message;
        }

        const updatedMessage = {
          ...lastMessage,
          content: newContent,
          events: (() => {
            const existingEvents = lastMessage.events || [];
            const isDuplicate = existingEvents.some(existingEvent =>
              JSON.stringify(existingEvent.msg) === JSON.stringify(event.msg)
            );
            return isDuplicate ? existingEvents : [...existingEvents, event];
          })(),
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
    if (event.msg.type === "agent_message_delta") {
      initialContent = event.msg.delta;
    } else if (event.msg.type === "agent_reasoning_raw_content_delta") {
        initialContent = event.msg.delta;
    } else if (event.msg.type === "agent_reasoning_raw_content") {
      initialContent = event.msg.text;
    } else if (event.msg.type === "agent_message") {
      initialContent = event.msg.message;
    } else if (event.msg.type === "task_complete" && event.msg.last_agent_message) {
      initialContent = event.msg.last_agent_message;
    }

    get().addMessage(conversationId, {
      id: event.id,
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
