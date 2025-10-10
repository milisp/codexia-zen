import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { useChatStore } from "@/stores/useChatStore";
import { useProviderStore } from "@/stores/useProviderStore";
import { useSessionStore } from "@/stores/useSessionStore";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { EventMsg } from "@/bindings/EventMsg";
import { Message } from "@/bindings/Message";
import { InputItem } from "@/bindings/InputItem";
import { NewConversationResponse } from "@/bindings/NewConversationResponse";
import { ConversationSummary } from "@/bindings/ConversationSummary";
import { ConversationList } from "./ConversationList";
import { ChatPanel } from "./ChatPanel";
import { v4 } from "uuid";
import { getNewConversationParams } from "@/config/ConversationParams";
import { useConversationStore } from "@/stores/useConversationStore";

export function ChatView() {
  const {
    messages,
    currentMessage,
    addMessage,
    updateLastAgentMessage,
    setCurrentMessage,
  } = useChatStore();
  const {
    activeConversationId,
    setActiveConversationId,
    addConversation,
  } = useConversationStore();
  const {
    sessionId,
    isInitializing,
    setSessionId,
    setSessionActive,
    setIsInitializing,
    setError,
  } = useSessionStore();
  const { providers, selectedProviderId } = useProviderStore();
  const provider = providers.find(p => p.id === selectedProviderId);
  const apiKey = provider?.apiKey ?? '';
  const [isSending, setIsSending] = useState(false);

  const activeMessages = messages[activeConversationId || ""] || [];

  useEffect(() => {
    let unlistenEvents: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenEvents = await listen<[string, EventMsg]>("codex_event", ({ payload: [, event] }) => {
        const msgType = event.type;
        if ("agent_message_delta" !== msgType) {
          console.log(`Received codex_event [${activeConversationId}]:`, event);
        }
        const convId = activeConversationId;
        if (!convId) return;
        if (msgType === "agent_message_delta") {
          updateLastAgentMessage(convId, event.delta);
        }
      });

      unlistenError = await listen<string>("app_server_error", ({ payload }) => {
        setError(`App Server Error: ${payload}`);
      });
    };

    setupListeners();

    return () => {
      if (unlistenEvents) unlistenEvents();
      if (unlistenError) unlistenError();
    };
  }, [activeConversationId, updateLastAgentMessage, setError]);

  const handleStartSession = async () => {
    if (sessionId) {
      return sessionId;
    }
    setIsInitializing(true);
    setError(null);
    const uuid = v4()
    try {
      await invoke("start_chat_session", {
        sessionId: uuid,
        apiKey: apiKey,
        provider: provider?.id,
      });
      setSessionActive(true);
      setSessionId(uuid);
      return uuid;
    } catch (error) {
      console.error("Failed to start session:", error);
      setError(`Failed to start session: ${error}`);
      setIsInitializing(false);
      return null;
    }
  };

  const handleNewConversation = async () => {
    const currentSessionId = await handleStartSession()
    if (!currentSessionId) {
      toast.error("Failed to start session for new conversation.");
      return;
    }
    try {
      const params = getNewConversationParams();
      const response: NewConversationResponse = await invoke<NewConversationResponse>(
        "new_conversation",
        { sessionId: currentSessionId, params },)
      console.log("new_conversation response:", response);
      const newConversationId = response?.conversationId;
      if (!newConversationId) {
        setError("Failed to create new conversation: server returned no id.");
        toast.error("Failed to create conversation");
        return;
      }
      const newConversation: ConversationSummary = {
        conversationId: newConversationId,
        preview: `Chat - ${new Date().toLocaleTimeString()}`,
        path: response.rolloutPath,
        timestamp: new Date().toLocaleTimeString(),
      };
      addConversation(newConversation);
      setActiveConversationId(newConversationId);
    } catch (error) {
      console.error("new_conversation error:", error);
      setError(`Failed to create new conversation: ${error}`);
    }
  };

  const handleSendMessage = async () => {
    let currentSessionId = sessionId;
    if (!activeConversationId) {
      currentSessionId = await handleStartSession();
      if (!currentSessionId) {
        toast.error("Failed to start session for sending message.");
        return;
      }
    }

    if (!currentSessionId) {
      toast.error("No active session.");
      return;
    }

    if (isSending || currentMessage.trim() === "") return;
    setIsSending(true);
    let conversationIdToUse = activeConversationId;

    if (!conversationIdToUse) {
      try {
        const params = getNewConversationParams();
        const response = await invoke<NewConversationResponse>(
          "new_conversation",
          { sessionId: currentSessionId, params })
        console.log("new_conversation response (from send flow):", response);
        const newConversationId = response?.conversationId;
        if (!newConversationId) {
          toast.error("Failed to create conversation");
          setIsSending(false);
          return;
        }
        const newConversation: ConversationSummary = {
          conversationId: newConversationId,
          preview: `Chat - ${new Date().toLocaleTimeString()}`,
          path: "",
          timestamp: new Date().toLocaleTimeString(),
        };
        addConversation(newConversation);
        setActiveConversationId(newConversationId);
        conversationIdToUse = newConversationId;
      } catch (error) {
        console.error("Failed to create conversation before send:", error);
        setError(`Failed to create new conversation: ${error}`);
        setIsSending(false);
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: currentMessage,
      sender: "user",
      timestamp: BigInt(Date.now()),
    };
    addMessage(conversationIdToUse, userMessage);
    const messageToSend = currentMessage;
    setCurrentMessage("");

    try {
      await invoke("send_message", {
        sessionId: currentSessionId,
        conversationId: conversationIdToUse,
        items: [{ type: "text", data: { text: messageToSend } } as InputItem],
      });
      setIsSending(false);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("send error");
      setError(`Error sending message: ${error}`);
      // Optional: Add error message to chat
      const errorMessage: Message = {
        id: Date.now().toString() + "-error",
        text: `Error: ${(error as Error).message}`,
        sender: "agent",
        timestamp: BigInt(Date.now()),
      };
      if (activeConversationId) {
        addMessage(activeConversationId, errorMessage);
      }
      setIsSending(false);
    }
  };



  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-screen">
      <ResizablePanel>
        <ConversationList
          handleNewConversation={handleNewConversation}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel>
        <ChatPanel
          activeConversationId={activeConversationId}
          activeMessages={activeMessages}
          currentMessage={currentMessage}
          setCurrentMessage={setCurrentMessage}
          handleSendMessage={handleSendMessage}
          isSending={isSending}
          isInitializing={isInitializing}
        />
      </ResizablePanel>
      </ResizablePanelGroup>
  );
}
