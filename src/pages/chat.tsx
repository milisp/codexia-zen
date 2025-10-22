import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import { ConversationList } from "@/components/ConversationList";
import { ChatPanel } from "@/components/ChatPanel";
import { getNewConversationParams } from "@/components/config/ConversationParams";
import { useConversationStore } from "@/stores/useConversationStore";
import { useConversationListStore } from "@/stores/useConversationListStore";
import { useSessionStore } from "@/stores/useSessionStore";
import { useProviderStore } from "@/stores/useProviderStore";
import { useSandboxStore } from "@/stores/useSandboxStore";
import { useCodexStore } from "@/stores/useCodexStore";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import type { EventMsg } from "@/bindings/EventMsg";
import type { NewConversationResponse } from "@/bindings/NewConversationResponse";
import type { SendUserMessageParams } from "@/bindings/SendUserMessageParams";
import type { SendUserMessageResponse } from "@/bindings/SendUserMessageResponse";
import type { InputItem } from "@/bindings/InputItem";
import {
  DELTA_EVENT_TYPES,
  type ConversationEvent,
  type ConversationEventPayload,
  type EventWithId,
} from "@/types/chat";

const PREVIEW_EVENT_TYPES = new Set<EventMsg["type"]>([
  "user_message",
  "agent_message",
  "error",
  "stream_error",
  "task_complete",
]);

function createEventId(raw: unknown): string {
  if (typeof raw === "string" && raw.length > 0) {
    return raw;
  }
  if (typeof raw === "number") {
    return raw.toString();
  }
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}`;
}

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

  const eventsByConversation = useConversationStore(
    (state) => state.eventsByConversation,
  );
  const currentMessage = useConversationStore((state) => state.currentMessage);
  const setCurrentMessage = useConversationStore(
    (state) => state.setCurrentMessage,
  );
  const appendEvent = useConversationStore((state) => state.appendEvent);
  const replaceEvents = useConversationStore((state) => state.replaceEvents);

  const activeConversationId = useConversationListStore(
    (state) => state.activeConversationId,
  );
  const setActiveConversationId = useConversationListStore(
    (state) => state.setActiveConversationId,
  );
  const addConversation = useConversationListStore(
    (state) => state.addConversation,
  );
  const updateConversationPreview = useConversationListStore(
    (state) => state.updateConversationPreview,
  );
  const updateConversationPath = useConversationListStore(
    (state) => state.updateConversationPath,
  );

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

  const [deltaEventMap, setDeltaEventMap] = useState<Record<string, EventWithId[]>>({});

  const activeEvents: ConversationEvent[] = useMemo(() => {
    if (!activeConversationId) return [];
    return eventsByConversation[activeConversationId] ?? [];
  }, [eventsByConversation, activeConversationId]);

  const activeDeltaEvents: EventWithId[] = useMemo(() => {
    if (!activeConversationId) return [];
    return deltaEventMap[activeConversationId] ?? [];
  }, [deltaEventMap, activeConversationId]);

  useEffect(() => {
    setDeltaEventMap((prev) => {
      let changed = false;
      const next: Record<string, EventWithId[]> = {};
      for (const [key, value] of Object.entries(prev)) {
        if (eventsByConversation[key]) {
          next[key] = value;
        } else {
          changed = true;
          console.debug("[chat] dropping delta buffer for conversation", key);
        }
      }
      if (!changed && Object.keys(next).length === Object.keys(prev).length) {
        return prev;
      }
      return next;
    });
  }, [eventsByConversation]);

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    const setup = async () => {
    try {
      const codexEvents = await listen<ConversationEventPayload>(
        "codex:event",
        (event) => {
            const payload = event.payload;
            if (!payload || !payload.params) return;
            const { conversationId, msg } = payload.params;
            if (!conversationId || !msg) return;

            const eventMsg = msg as EventMsg;
            if (typeof eventMsg !== "object" || typeof eventMsg.type !== "string") {
              return;
            }

            const baseId = createEventId(payload.params.id);
            const uniqueSuffix =
              typeof window !== "undefined" && window.crypto?.randomUUID
                ? window.crypto.randomUUID()
                : `${Date.now()}-${Math.random()}`;
            const eventId = `${conversationId}-${baseId}-${uniqueSuffix}`;
            const eventRecord: EventWithId = {
              id: eventId,
              msg: eventMsg,
            };

            console.debug("[codex:event]", conversationId, eventMsg.type, eventRecord);

            if (DELTA_EVENT_TYPES.has(eventMsg.type)) {
              setDeltaEventMap((prev) => {
                const current = prev[conversationId] ?? [];
                return {
                  ...prev,
                  [conversationId]: [...current, eventRecord],
                };
              });
              return;
            }

            appendEvent(conversationId, eventRecord);

            if (PREVIEW_EVENT_TYPES.has(eventMsg.type)) {
              let preview: string | null = null;
              if ("message" in eventMsg && typeof eventMsg.message === "string") {
                preview = eventMsg.message;
              } else if (eventMsg.type === "task_complete") {
                preview = eventMsg.last_agent_message ?? null;
              }
              if (preview && preview.trim().length > 0) {
                updateConversationPreview(conversationId, preview.trim());
              }
            }

            if (eventMsg.type === "task_complete" || eventMsg.type === "error" || eventMsg.type === "turn_aborted") {
              setIsSending(false);
            }

            if (isInitializing && conversationId === activeConversationId) {
              setIsInitializing(false);
            }

            setDeltaEventMap((prev) => {
              if (!prev[conversationId] || prev[conversationId].length === 0) {
                return prev;
              }
              console.debug("[chat] flushing delta events", conversationId);
              const { [conversationId]: _removed, ...rest } = prev;
              return rest;
            });
          },
        );

        unlisteners.push(codexEvents);
      } catch (error) {
        console.error("Failed to initialize Codex listeners", error);
      }
    };

    setup();

    return () => {
      unlisteners.forEach((unlisten) => {
        try {
          unlisten();
        } catch (error) {
          console.warn("Failed to remove Codex listener", error);
        }
      });
    };
  }, [
    appendEvent,
    updateConversationPreview,
    setIsInitializing,
    setIsSending,
    isInitializing,
    activeConversationId,
  ]);

  const handleNewConversation = useCallback(async (): Promise<string | null> => {
    if (!cwd) {
      console.warn("Select a project before starting a conversation.");
      return null;
    }

    const provider = providers.find((item) => item.id === selectedProviderId);
    setIsInitializing(true);
    try {
      console.info("[chat] initialize_codex");
      await invoke("initialize_codex");

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
        preview: "New conversation",
        path: conversation.rolloutPath,
      });
      updateConversationPath(conversationId, conversation.rolloutPath);
      setActiveConversationId(conversationId);
      replaceEvents(conversationId, []);
      setDeltaEventMap((prev) => ({
        ...prev,
        [conversationId]: [],
      }));
      setIsInitializing(false);
      return conversationId;
    } catch (error) {
      console.error("Failed to start Codex conversation", error);
      setIsInitializing(false);
      return null;
    }
  }, [
    addConversation,
    approvalPolicy,
    cwd,
    mode,
    providers,
    reasoningEffort,
    replaceEvents,
    selectedModel,
    selectedProviderId,
    setActiveConversationId,
    setIsInitializing,
    updateConversationPath,
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
    const activeId = activeConversationId;
    if (!activeId) {
      console.warn("Start a conversation before sending messages.");
      return;
    }

    const originalMessage = currentMessage;
    const trimmed = originalMessage.trim();
    if (!trimmed) return;

    setIsSending(true);
    setCurrentMessage("");

    let pendingRestore: string | null = null;

    try {
      const params = buildTextMessageParams(activeId, trimmed);
      console.info("[chat] send_user_message", activeId, trimmed.length);
      await sendConversationMessage(params);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to send message", error);
      pendingRestore = originalMessage;

      if (message.includes("conversation not found")) {
        console.warn("Conversation missing on Codex server; creating a new one.");
        const newConversationId = await handleNewConversation();
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
    currentMessage,
    handleNewConversation,
    sendConversationMessage,
    setCurrentMessage,
    setIsSending,
  ]);

  const focusChatInput = () => {
    textAreaRef.current?.focus();
  };

  const handleNewConversationAndFocus = useCallback(async () => {
    const conversationId = await handleNewConversation();
    if (conversationId) {
      focusChatInput();
    } else {
      console.warn("[chat] failed to create conversation; focus not moved");
    }
  }, [handleNewConversation]);

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-screen">
      <ResizablePanel defaultSize={20}>
        <ConversationList
          onNewTempConversation={handleNewConversationAndFocus}
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
          textAreaRef={textAreaRef}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
