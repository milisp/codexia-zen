import { useState } from "react";
import { useChatListeners } from "./useChatListeners";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { v4 } from "uuid";
import { useChatStore } from "@/stores/useChatStore";
import { useProviderStore } from "@/stores/useProviderStore";
import { useSessionStore } from "@/stores/useSessionStore";
import { useCodexStore } from "@/stores/useCodexStore";
import { useConversationStore } from "@/stores/useConversationStore";
import { Message } from "@/types/Message";
import { InputItem } from "@/bindings/InputItem";
import { NewConversationResponse } from "@/bindings/NewConversationResponse";
import { ConversationSummary } from "@/bindings/ConversationSummary";
import { getNewConversationParams } from "@/config/ConversationParams";
import { useSandboxStore } from "@/stores/useSandboxStore";
import { mapProviderToEnvKey } from "@/utils/mapProviderEnvKey";

export function useChatSession() {
  const { addMessage, setCurrentMessage } = useChatStore();
  const { activeConversationId, setActiveConversationId, addConversation } =
    useConversationStore();
  const {
    sessionId,
    setSessionId,
    setSessionActive,
    setIsInitializing,
  } = useSessionStore();
  const { providers, selectedProviderId, selectedModel } = useProviderStore();
  const provider = providers.find((p) => p.id === selectedProviderId);
  const { cwd } = useCodexStore();
  const { mode, approvalPolicy } = useSandboxStore();
  const [isSending, setIsSending] = useState(false);
  useChatListeners(setIsSending);

  const handleStartSession = async () => {
    if (sessionId) {
      return sessionId;
    }
    setIsInitializing(true);
    const uuid = v4();
    try {
      await invoke("start_chat_session", {
        sessionId: uuid,
        apiKey: provider?.apiKey ?? "",
        envKey: mapProviderToEnvKey(provider?.id),
      });
      setSessionActive(true);
      setSessionId(uuid);
      setIsInitializing(false);
      return uuid;
    } catch (error) {
      console.error("Failed to start session:", error);
      setIsInitializing(false);
      return null;
    }
  };

  const handleSendMessage = async (currentMessage: string) => {
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
        const params = getNewConversationParams(provider, selectedModel, cwd, approvalPolicy, mode);
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
        conversationIdToUse = newConversationId;

        // Wait for activeConversationId to be updated in the store
        let attempts = 0;
        const maxAttempts = 10;
        const delay = 50;
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
      } catch (error) {
        console.error("Failed to create conversation before send:", error);
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
    addMessage(conversationIdToUse, {
      id: Date.now().toString() + "-agent",
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      events: [],
    });

    setCurrentMessage("");

    try {
      await invoke("send_message", {
        sessionId: currentSessionId,
        conversationId: conversationIdToUse,
        items: [{ type: "text", data: { text: currentMessage } } as InputItem],
      });
      setIsSending(false);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("send error");
      setIsSending(false);
    }
  };

  return {
    isSending,
    handleStartSession,
    handleSendMessage,
  };
}
