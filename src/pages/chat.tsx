import { useCallback, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { ConversationList } from "@/components/ConversationList";
import { ChatPanel } from "@/components/ChatPanel";
import { getNewConversationParams } from "@/components/config/ConversationParams";
import { toast } from "@/components/ui/use-toast";
import { useConversationStore } from "@/stores/useConversationStore";
import { useConversationListStore } from "@/stores/useConversationListStore";
import { useSessionStore } from "@/stores/useSessionStore";
import { useProviderStore } from "@/stores/useProviderStore";
import { useSandboxStore } from "@/stores/useSandboxStore";
import { useCodexStore } from "@/stores/useCodexStore";
import { useCodexEvents } from "@/hooks/useCodexEvents";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import type { NewConversationResponse } from "@/bindings/NewConversationResponse";
import type { SendUserMessageParams } from "@/bindings/SendUserMessageParams";
import type { SendUserMessageResponse } from "@/bindings/SendUserMessageResponse";
import type { InputItem } from "@/bindings/InputItem";
import { type ConversationEvent, type EventWithId } from "@/types/chat";

function buildTextMessageParams(
  conversationId: string,
  text: string,
): SendUserMessageParams {
  const textItem: InputItem = {
    type: "text",
    data: { text },
  };
  return {
    conversationId,
    items: [textItem],
  };
}

export default function ChatPage() {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const codexInitializedRef = useRef(false);
  const initializationPromiseRef = useRef<Promise<void> | null>(null);
  const createConversationPromiseRef = useRef<Promise<string | null> | null>(
    null,
  );

  const eventsByConversation = useConversationStore(
    (state) => state.eventsByConversation,
  );
  const currentMessage = useConversationStore((state) => state.currentMessage);
  const setCurrentMessage = useConversationStore(
    (state) => state.setCurrentMessage,
  );
  const appendEvent = useConversationStore((state) => state.appendEvent);
  const replaceEvents = useConversationStore((state) => state.replaceEvents);

  const {
    activeConversationId,
    setActiveConversationId,
    addConversation,
  } = useConversationListStore();

  const isInitializing = useSessionStore((state) => state.isInitializing);
  const isSending = useSessionStore((state) => state.isSending);
  const setIsInitializing = useSessionStore((state) => state.setIsInitializing);
  const setIsSending = useSessionStore((state) => state.setIsSending);

  const {
    providers,
    selectedProviderId,
    selectedModel,
    reasoningEffort,
  } = useProviderStore();
  const { mode, approvalPolicy } = useSandboxStore();
  const { cwd } = useCodexStore();

  const { deltaEventMap, initializeConversationBuffer } = useCodexEvents({
    eventsByConversation,
    activeConversationId,
    appendEvent,
    setIsInitializing,
    setIsSending,
    isInitializing,
  });

  const ensureCodexInitialized = useCallback(async () => {
    if (codexInitializedRef.current) {
      return;
    }

    if (!initializationPromiseRef.current) {
      console.info("[chat] initialize_codex");
      setIsInitializing(true);
      initializationPromiseRef.current = invoke("initialize_codex")
        .then(() => {
          codexInitializedRef.current = true;
        })
        .finally(() => {
          initializationPromiseRef.current = null;
          setIsInitializing(false);
        });
    }

    try {
      await initializationPromiseRef.current;
    } catch (error) {
      console.error("Failed to initialize Codex client", error);
      codexInitializedRef.current = false;
      throw error;
    }
  }, [setIsInitializing]);

  const activeEvents: ConversationEvent[] = useMemo(() => {
    if (!activeConversationId) return [];
    return eventsByConversation[activeConversationId] ?? [];
  }, [eventsByConversation, activeConversationId]);

  const activeDeltaEvents: EventWithId[] = useMemo(() => {
    if (!activeConversationId) return [];
    return deltaEventMap[activeConversationId] ?? [];
  }, [deltaEventMap, activeConversationId]);

  const createConversation = useCallback(async (): Promise<string | null> => {
    if (createConversationPromiseRef.current) {
      return createConversationPromiseRef.current;
    }

    if (!cwd) {
      console.warn("Select a project before starting a conversation.");
      return null;
    }

    const provider = providers.find((item) => item.id === selectedProviderId);

    const promise = (async () => {
      setIsInitializing(true);
      try {
        const params = getNewConversationParams(
          provider,
          selectedModel ?? null,
          cwd,
          approvalPolicy,
          mode,
          {
            model_reasoning_effort: reasoningEffort,
          },
        );

        console.info("[chat] new_conversation", params);
        const conversation = await invoke<NewConversationResponse>(
          "new_conversation",
          { params },
        );

        console.info("[chat] conversation created", conversation);

        const conversationId = conversation.conversationId;
        addConversation(cwd, {
          conversationId,
          preview: currentMessage || "New conversation",
          path: conversation.rolloutPath,
          timestamp: new Date().toISOString(),
        });
        setActiveConversationId(conversationId);
        replaceEvents(conversationId, []);
        initializeConversationBuffer(conversationId);
        return conversationId;
      } catch (error) {
        console.error("Failed to start Codex conversation", error);
        return null;
      } finally {
        setIsInitializing(false);
        createConversationPromiseRef.current = null;
      }
    })();

    createConversationPromiseRef.current = promise;
    return promise;
  }, [
    addConversation,
    approvalPolicy,
    cwd,
    initializeConversationBuffer,
    mode,
    providers,
    reasoningEffort,
    replaceEvents,
    selectedModel,
    selectedProviderId,
    setActiveConversationId,
    setIsInitializing,
    currentMessage,
  ]);

  const sendConversationMessage = useCallback(
    async (params: SendUserMessageParams) => {
      console.debug(
        "[chat] invoke send_user_message",
        params.conversationId,
        params.items.length,
      );
      await invoke<SendUserMessageResponse>("send_user_message", {
        params,
      });
      console.debug(
        "[chat] send_user_message success",
        params.conversationId,
      );
    },
    [],
  );

  const handleSendMessage = useCallback(async () => {
    if (!cwd) {
      console.warn("Select a project before sending messages.");
      return;
    }

    const originalMessage = currentMessage;
    const trimmed = originalMessage.trim();
    if (!trimmed) return;

    setIsSending(true);
    // Maintain the original message temporarily for preview during conversation creation
    let pendingRestore: string | null = originalMessage;

    try {
      await ensureCodexInitialized();

      let targetConversationId = activeConversationId;
      if (!targetConversationId) {
        const newConversationId = await createConversation();
        if (!newConversationId) {
          throw new Error("Failed to create conversation");
        }
        targetConversationId = newConversationId;
      }
      // Clear the message input after ensuring the conversation exists
      setCurrentMessage("");

      const params = buildTextMessageParams(targetConversationId, trimmed);
      console.info("[chat] send_user_message", targetConversationId, trimmed.length);
      await sendConversationMessage(params);
      pendingRestore = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to send message", error);

      if (message.includes("conversation not found")) {
        console.warn("Conversation missing on Codex server; creating a new one.");
        const newConversationId = await createConversation();
        if (newConversationId) {
          try {
            console.info("[chat] resend send_user_message", newConversationId);
            const resendParams = buildTextMessageParams(newConversationId, trimmed);
            await sendConversationMessage(resendParams);
            pendingRestore = null;
          } catch (resendErr) {
            console.error("Failed to resend message", resendErr);
          }
        }
      }
    } finally {
      if (pendingRestore) {
        setCurrentMessage(pendingRestore);
      }
      setIsSending(false);
    }
  }, [
    activeConversationId,
    createConversation,
    currentMessage,
    cwd,
    ensureCodexInitialized,
    sendConversationMessage,
    setCurrentMessage,
    setIsSending,
  ]);

  useEffect(() => {
    const unlisten = listen("codex:process-exited", () => {
      console.warn("[chat] codex:process-exited");
      toast({
        title: "Codex app-server exited",
        description: "The Codex app-server process exited unexpectedly. Please restart the application.",
        variant: "destructive",
      });
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);
  const focusChatInput = useCallback(() => {
    textAreaRef.current?.focus();
  }, []);

  const handlePrepareNewConversation = useCallback(() => {
    if (!cwd) {
      console.warn("Select a project before starting a conversation.");
      return;
    }
    setActiveConversationId(null);
    setCurrentMessage("");
    focusChatInput();
  }, [cwd, focusChatInput, setActiveConversationId, setCurrentMessage]);

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-screen">
      <ResizablePanel defaultSize={20}>
        <ConversationList
          onNewTempConversation={handlePrepareNewConversation}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel>
        <ChatPanel
          conversationId={activeConversationId}
          events={activeEvents}
          deltaEvents={activeDeltaEvents}
          currentMessage={currentMessage}
          setCurrentMessage={setCurrentMessage}
          handleSendMessage={handleSendMessage}
          isSending={isSending}
          isInitializing={isInitializing}
          canCompose={Boolean(cwd)}
          textAreaRef={textAreaRef}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
