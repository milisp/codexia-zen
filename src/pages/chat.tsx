import { useCallback, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

import { ConversationList } from "@/components/ConversationList";
import { ChatPanel } from "@/components/ChatPanel";
import { getNewConversationParams } from "@/components/config/ConversationParams";
import { useConversationStore } from "@/stores/useConversationStore";
import { useConversationListStore } from "@/stores/useConversationListStore";
import { useActiveConversationStore } from "@/stores/useActiveConversationStore";
import { useSessionStore } from "@/stores/useSessionStore";
import { useProviderStore } from "@/stores/useProviderStore";
import { useSandboxStore } from "@/stores/useSandboxStore";
import { useCodexStore } from "@/stores/useCodexStore";
import { useCodexEvents } from "@/hooks/useCodexEvents";
import { useCodexApprovalRequests } from "@/hooks/useCodexApprovalRequests";
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
  const createConversationPromiseRef = useRef<Promise<string | null> | null>(
    null,
  );

  const {
    eventsByConversation,
    appendEvent,
    replaceEvents,
    currentMessage,
    setCurrentMessage,
  } = useConversationStore();

    const { addConversation } = useConversationListStore();

    const { activeConversationId, setActiveConversationId } = useActiveConversationStore();

  const { isInitializing, isSending, setIsInitializing, setIsSending } =
    useSessionStore();

  const { providers, selectedProviderId, selectedModel, reasoningEffort } =
    useProviderStore();
  const { mode, approvalPolicy } = useSandboxStore();
  const { cwd } = useCodexStore();

  const { deltaEventMap, initializeConversationBuffer } = useCodexEvents({
    eventsByConversation,
    appendEvent,
    setIsInitializing,
    setIsSending,
    isInitializing,
  });

  useCodexApprovalRequests();

  const activeEvents: ConversationEvent[] = useMemo(() => {
    if (!activeConversationId) return [];
    return eventsByConversation[activeConversationId] ?? [];
  }, [eventsByConversation, activeConversationId]);

  const activeDeltaEventsRef = useRef<EventWithId[]>([]);

  const activeDeltaEvents: EventWithId[] = useMemo(() => {
    if (!activeConversationId) return [];
    const newDeltaEvents = deltaEventMap[activeConversationId] ?? [];

    // Deep compare newDeltaEvents with the current value in the ref
    // If they are deeply equal, return the ref's current value to maintain referential stability
    if (
      JSON.stringify(newDeltaEvents) ===
      JSON.stringify(activeDeltaEventsRef.current)
    ) {
      return activeDeltaEventsRef.current;
    }

    activeDeltaEventsRef.current = newDeltaEvents;
    return newDeltaEvents;
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
          preview:
            useConversationStore.getState().currentMessage ||
            "New conversation",
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
      console.debug("[chat] send_user_message success", params.conversationId);
    },
    [],
  );

  const handleSendMessage = useCallback(async () => {
    if (!cwd) {
      console.warn("Select a project before sending messages.");
      return;
    }

    const originalMessage = useConversationStore.getState().currentMessage;
    const trimmed = originalMessage.trim();
    if (!trimmed) return;

    setIsSending(true);
    // Maintain the original message temporarily for preview during conversation creation
    let pendingRestore: string | null = originalMessage;

    try {
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
      console.info(
        "[chat] send_user_message",
        targetConversationId,
        trimmed.length,
      );
      await sendConversationMessage(params);
      pendingRestore = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to send message", error);

      if (message.includes("conversation not found")) {
        console.warn(
          "Conversation missing on Codex server; creating a new one.",
        );
        const newConversationId = await createConversation();
        if (newConversationId) {
          try {
            console.info("[chat] resend send_user_message", newConversationId);
            const resendParams = buildTextMessageParams(
              newConversationId,
              trimmed,
            );
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
    cwd,

    sendConversationMessage,
    setCurrentMessage,
    setIsSending,
  ]);

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
