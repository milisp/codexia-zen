import { create } from "zustand";
import { ConversationSummary } from "@/bindings/ConversationSummary";
import { EventMsg } from "@/bindings/EventMsg";
import { Message } from "@/types";
import { EventWithId } from "@/types/Message";

type ChatState = {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  messages: Record<string, Message[]>;
  currentMessage: string;
};

type ChatActions = {
  setConversations: (conversations: ConversationSummary[]) => void;
  setActiveConversationId: (conversationId: string | null) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateLastAgentMessage: (conversationId: string, event: EventWithId) => void;
  clearMessages: (conversationId: string) => void;
  setCurrentMessage: (message: string) => void;
};

const extractEventContent = (msg: EventMsg): string => {
  switch (msg.type) {
    case "agent_message_delta":
    case "agent_reasoning_raw_content_delta":
      return msg.delta;
    case "agent_message":
      return msg.message;
    case "agent_reasoning_raw_content":
      return msg.text;
    case "task_complete":
      return msg.last_agent_message || "";
    default:
      return "";
  }
};

export const useChatStore = create<ChatState & ChatActions>()((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  currentMessage: "",

  setConversations: (conversations) => set({ conversations }),
  setActiveConversationId: (conversationId) => set({ activeConversationId: conversationId }),

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
    const lastMessage = messages[messages.length - 1];

    if (lastMessage?.role === "assistant") {
      const existingEvents = lastMessage.events || [];
      const isDuplicate = existingEvents.some(
        (e) => JSON.stringify(e.msg) === JSON.stringify(event.msg)
      );

      const contentDelta = extractEventContent(event.msg);
      const newContent = event.msg.type.includes("delta")
        ? (lastMessage.content || "") + contentDelta
        : contentDelta || lastMessage.content;

      const updatedMessage = {
        ...lastMessage,
        content: newContent,
        events: isDuplicate ? existingEvents : [...existingEvents, event],
      };

      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: [...messages.slice(0, -1), updatedMessage],
        },
      }));
    } else {
      get().addMessage(conversationId, {
        id: event.id,
        role: "assistant",
        content: extractEventContent(event.msg),
        timestamp: Date.now(),
        events: [event],
      });
    }
  },

  clearMessages: (conversationId) => {
    set((state) => {
      const { [conversationId]: _, ...rest } = state.messages;
      return { messages: rest };
    });
  },

  setCurrentMessage: (message) => set({ currentMessage: message }),
}));
