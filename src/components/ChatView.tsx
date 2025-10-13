import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { useChatStore } from "@/stores/useChatStore";
import { useProviderStore } from "@/stores/useProviderStore";
import { useSessionStore } from "@/stores/useSessionStore";
import { useCodexStore } from "@/stores/useCodexStore";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { EventMsg } from "@/bindings/EventMsg";
import { Message } from "@/types/Message";
import { InputItem } from "@/bindings/InputItem";
import { NewConversationResponse } from "@/bindings/NewConversationResponse";
import { ConversationSummary } from "@/bindings/ConversationSummary";
import { ConversationList } from "./ConversationList";
import { ChatPanel } from "./ChatPanel";
import { v4 } from "uuid";
import { getNewConversationParams } from "@/config/ConversationParams";
import { useConversationStore } from "@/stores/useConversationStore";

export function ChatView() {
  const chatInputRef = useRef<HTMLInputElement>(null);
  const {
    messages,
    currentMessage,
    addMessage,
    updateLastAgentMessage,
    setCurrentMessage,
  } = useChatStore();
  const { activeConversationId, setActiveConversationId, addConversation } =
    useConversationStore();
  const {
    sessionId,
    isInitializing,
    setSessionId,
    setSessionActive,
    setIsInitializing,
    setError,
  } = useSessionStore();
  const { providers, selectedProviderId } = useProviderStore();
  const provider = providers.find((p) => p.id === selectedProviderId);
  const apiKey = provider?.apiKey ?? "";
  const selectedModel = useProviderStore().selectedModel;
  const { cwd } = useCodexStore();
  const [isSending, setIsSending] = useState(false);

  const activeMessages = messages[activeConversationId || ""] || [];

  const focusChatInput = () => {
    chatInputRef.current?.focus();
  };

  useEffect(() => {
    let unlistenEvents: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenEvents = await listen<[string, EventMsg]>(
        "codex-event",
        (event) => {
          const [, eventMsg] = event.payload;
          console.log(`Received codex-event:`, eventMsg);
          if (!eventMsg || typeof eventMsg.type === "undefined") {
            console.error("Received malformed codex-event payload:", eventMsg);
            return;
          }

          const convId = useConversationStore.getState().activeConversationId;
          if (!convId) return;
          updateLastAgentMessage(convId, eventMsg);
        },
      );

      unlistenError = await listen<string>(
        "app_server_error",
        ({ payload }) => {
          setError(`App Server Error: ${payload}`);
          setIsInitializing(false);
          setIsSending(false);
        },
      );
    };

    setupListeners();

    return () => {
      if (unlistenEvents) unlistenEvents();
      if (unlistenError) unlistenError();
    };
  }, [updateLastAgentMessage, setError, setIsInitializing, setIsSending]);

  const handleStartSession = async () => {
    if (sessionId) {
      return sessionId;
    }
    setIsInitializing(true);
    setError(null);
    const uuid = v4();
    try {
      await invoke("start_chat_session", {
        sessionId: uuid,
        apiKey: apiKey,
        provider: provider?.id,
      });
      setSessionActive(true);
      setSessionId(uuid);
      setIsInitializing(false); // Set to false after successful initialization
      return uuid;
    } catch (error) {
      console.error("Failed to start session:", error);
      setError(`Failed to start session: ${error}`);
      setIsInitializing(false);
      return null;
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
        const params = getNewConversationParams(provider, selectedModel, cwd);
        const response = await invoke<NewConversationResponse>(
          "new_conversation",
          { sessionId: currentSessionId, params },
        );
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
          path: response.rolloutPath,
          timestamp: new Date().toLocaleTimeString(),
        };
        addConversation(newConversation);
        setActiveConversationId(newConversationId);
        conversationIdToUse = newConversationId; // Ensure local variable is updated

        // Wait for activeConversationId to be updated in the store
        let attempts = 0;
        const maxAttempts = 10; // Try for a short period
        const delay = 50; // Check every 50ms
        while (
          useConversationStore.getState().activeConversationId !==
            newConversationId &&
          attempts < maxAttempts
        ) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          attempts++;
        }

        if (
          useConversationStore.getState().activeConversationId !==
          newConversationId
        ) {
          toast.error("Failed to set active conversation ID in time.");
          setIsSending(false);
          return;
        }
        // Introduce a small delay to allow backend to register the new conversation
        // await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error("Failed to create conversation before send:", error);
        setError(`Failed to create new conversation: ${error}`);
        setIsSending(false);
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: currentMessage,
      role: "user",
      timestamp: Date.now(),
    };
    addMessage(conversationIdToUse, userMessage);
    // Add an initial empty agent message to hold events
    addMessage(conversationIdToUse, {
      id: Date.now().toString() + "-agent",
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      events: [],
    });

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
        content: `Error: ${(error as Error).message}`,
        role: "assistant",
        timestamp: Date.now(),
        events: [],
      };
      if (activeConversationId) {
        addMessage(activeConversationId, errorMessage);
      }
      setIsSending(false);
    }
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-screen">
      <ResizablePanel defaultSize={20}>
        <ConversationList onClearConversation={focusChatInput} />
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
          inputRef={chatInputRef}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
