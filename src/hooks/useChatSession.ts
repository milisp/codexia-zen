import { useState } from "react";
import { useChatListeners } from "./useChatListeners";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { v4 } from "uuid";
import { useConversationStore } from "@/stores/useConversationStore";
import { useProviderStore } from "@/stores/useProviderStore";
import { useSessionStore } from "@/stores/useSessionStore";
import { useCodexStore } from "@/stores/useCodexStore";
import { useConversationListStore } from "@/stores/useConversationListStore";
import { Message } from "@/types/Message";
import { InputItem } from "@/bindings/InputItem";
import { NewConversationResponse } from "@/bindings/NewConversationResponse";
import { getNewConversationParams } from "@/components/config/ConversationParams";
import { useSandboxStore } from "@/stores/useSandboxStore";
import { mapProviderToEnvKey } from "@/utils/mapProviderEnvKey";
import { ConversationSummary } from "@/bindings/ConversationSummary";

export function useChatSession() {
  const { addMessage, setCurrentMessage } =
    useConversationStore();
  const { activeConversationId, setActiveConversationId, addConversation } =
    useConversationListStore();
  const { sessionId, setSessionId, setSessionActive, setIsInitializing } =
    useSessionStore();
  const { providers, selectedProviderId, selectedModel, reasoningEffort } =
    useProviderStore();
  const provider = providers.find((p) => p.id === selectedProviderId);
  const { cwd } = useCodexStore();
  const { mode, approvalPolicy } = useSandboxStore();
  const [isSending, setIsSending] = useState(false);
  useChatListeners();

  const handleStartSession = async () => {
    if (sessionId) return sessionId;

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
      return uuid;
    } catch (error) {
      console.error("Failed to start session:", error);
      return null;
    } finally {
      setIsInitializing(false);
    }
  };

  const createNewConversation = async (
    currentSessionId: string,
    message: string,
  ): Promise<string | null> => {
    if (!cwd) {
      toast.error(
        "Cannot create conversation without active project directory",
      );
      return null;
    }

    const params = getNewConversationParams(
      provider,
      selectedModel,
      cwd,
      approvalPolicy,
      mode,
      { model_reasoning_effort: reasoningEffort },
    );

    const response = await invoke<NewConversationResponse>("new_conversation", {
      sessionId: currentSessionId,
      params,
    });

    if (!response?.conversationId) {
      console.error(
        "Failed to create conversation: No conversationId in response",
      );
      return null;
    }

    const newConversation: ConversationSummary = {
      conversationId: response.conversationId,
      preview: message,
      path: response.rolloutPath,
      timestamp: new Date().toLocaleTimeString(),
    };

    addConversation(cwd, newConversation);
    setActiveConversationId(response.conversationId);

    return response.conversationId;
  };

  const handleSendMessage = async (currentMessage: string) => {
    if (isSending || !currentMessage.trim()) return;

    setIsSending(true);

    try {
      let currentSessionId = sessionId;
      if (!activeConversationId) {
        currentSessionId = await handleStartSession();
        if (!currentSessionId) {
          toast.error("Failed to start session");
          return;
        }
      }

      if (!currentSessionId) {
        toast.error("No active session");
        return;
      }

      let conversationId = activeConversationId;
      if (!conversationId) {
        conversationId = await createNewConversation(
          currentSessionId,
          currentMessage,
        );
        if (!conversationId) {
          toast.error("Failed to create conversation");
          return;
        }
      }

      const userMessage: Message = {
        id: Date.now().toString(),
        content: currentMessage,
        role: "user",
        timestamp: Date.now(),
      };

      addMessage(conversationId, userMessage);
      setCurrentMessage("");

      await invoke("send_message", {
        sessionId: currentSessionId,
        conversationId,
        items: [{ type: "text", data: { text: currentMessage } } as InputItem],
      });
    } catch (error) {
      console.error("Error in handleSendMessage:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send message",
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleNewConversation = () => {
    // Do not start session or create conversation here
    setActiveConversationId(null);
    setCurrentMessage("");
  };

  return {
    isSending,
    handleStartSession,
    handleSendMessage,
    handleNewConversation,
  };
}
