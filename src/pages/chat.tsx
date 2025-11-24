import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { PencilIcon } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState, useCallback, useRef } from "react";
import { isBusyOffMsgTypes, useCodexStore } from "@/stores/useCodexStore";
import { useActiveConversationStore } from "@/stores/useActiveConversationStore";
import { useEventStore } from "@/stores/useEventStore";
import type { NewConversationResponse } from "@/bindings/NewConversationResponse";
import { StreamedEventNotification } from "@/types";
import {
  ThreadSidebar,
  ChatEvents,
  ChatInput,
} from "@/components/chat";
import type { NewConversationParams } from "@/bindings/NewConversationParams";
import { getNewConversationParams } from "@/components/codexConfig/ConversationParams";
import { useSandboxStore } from "@/stores/useSandboxStore";
import { ApprovalRequestPanel } from "@/components/chat/ApprovalRequestCard";
export default function ChatPage() {
  const {
    cwd,
    selectedModel,
    reasoningEffort,
    selectedProvider: selectedProviderName,
  } = useCodexStore();
  const { mode, approvalPolicy } = useSandboxStore();
  const [prompt, setPrompt] = useState("");
  const {
    activeConversationId,
    busyConversations,
    currentTurnIds,
    setActiveConversationId,
    setConversationBusy,
    setCurrentTurnId,
  } = useActiveConversationStore();

  const { eventsByConversationId, appendEvent, setConversationEvents } =
    useEventStore();
  const ensuringConversation = useRef<Promise<string> | null>(null);
  const pendingInterrupts = useRef<Set<string>>(new Set());
  const events = activeConversationId
    ? (eventsByConversationId[activeConversationId] ?? [])
    : [];

  const addEvent = useCallback(
    async (notification: StreamedEventNotification) => {
      const { params } = notification;
      if (!params.conversationId || !params.id || !params.msg) {
        return;
      }
      const { msg } = params;
      const turnIdFromMsg =
        "turn_id" in msg && typeof msg.turn_id === "string" ? msg.turn_id : null;
      if (turnIdFromMsg) {
        setCurrentTurnId(params.conversationId, turnIdFromMsg);
      }
      if (turnIdFromMsg && pendingInterrupts.current.has(params.conversationId)) {
        pendingInterrupts.current.delete(params.conversationId);
        try {
          await invoke("turn_interrupt", {
            threadId: params.conversationId,
            turnId: turnIdFromMsg,
          });
          setConversationBusy(params.conversationId, false);
          setCurrentTurnId(params.conversationId, null);
        } catch (error) {
          console.error("failed to deliver pending interrupt", error);
        }
      }
      if (isBusyOffMsgTypes.some((type) => type === msg.type)) {
        console.debug(
          "[chat] conversation event",
          params.conversationId,
          "off msg",
          msg.type,
        );
        setConversationBusy(params.conversationId, false);
        setCurrentTurnId(params.conversationId, null);
      }
      if (
        msg.type.startsWith("item_") ||
        msg.type === "token_count" ||
        msg.type.endsWith("_delta") ||
        msg.type === "agent_message_delta" ||
        msg.type === "exec_command_output_delta"
      ) {
        return;
      } else {
        if (!msg.type.endsWith("_delta")) {
          console.info(msg); // don't remove this
        }
      }
      appendEvent(params);
      setActiveConversationId(params.conversationId);
    },
    [appendEvent, setActiveConversationId, setConversationBusy, setCurrentTurnId],
  );

  useEffect(() => {
    invoke("initialize_client").catch((error) =>
      console.error("failed to initialize codex client", error),
    );

    const unlistenConversation = listen<StreamedEventNotification>(
      "codex://conversation-event",
      (event) => {
        addEvent(event.payload);
      },
    );

    const unlistenTurn = listen<{ conversationId: string; turnId: string }>(
      "codex://turn-event",
      async (event) => {
        const { conversationId, turnId } = event.payload ?? {};
        if (!conversationId || !turnId) {
          return;
        }
        setCurrentTurnId(conversationId, turnId);
        if (pendingInterrupts.current.has(conversationId)) {
          pendingInterrupts.current.delete(conversationId);
          try {
            await invoke("turn_interrupt", { threadId: conversationId, turnId });
            setConversationBusy(conversationId, false);
            setCurrentTurnId(conversationId, null);
          } catch (error) {
            console.error("failed to deliver pending interrupt", error);
          }
        }
      },
    );

    return () => {
      unlistenConversation.then((fn) => fn());
      unlistenTurn.then((fn) => fn());
    };
  }, [addEvent, setConversationBusy, setCurrentTurnId]);

  useEffect(() => {
    if (activeConversationId) {
      invoke("add_conversation_listener", {
        conversationId: activeConversationId,
      }).catch((error) =>
        console.error(
          `failed to add listener for conversation ${activeConversationId}`,
          error,
        ),
      );
    }
  }, [activeConversationId]);

  const buildConversationParams = (): NewConversationParams =>
    getNewConversationParams(
      selectedProviderName,
      selectedModel,
      cwd ?? null,
      approvalPolicy,
      mode,
      {
        model_reasoning_effort: reasoningEffort,
      },
    );

  const ensureConversation = async (): Promise<string> => {
    if (activeConversationId) {
      return activeConversationId;
    }

    if (ensuringConversation.current) {
      return ensuringConversation.current;
    }

    const creationPromise = (async () => {
      const params = buildConversationParams();
      const conversation = await invoke<NewConversationResponse>(
        "new_conversation",
        { params },
      );
      setConversationEvents(conversation.conversationId, []);
      setActiveConversationId(conversation.conversationId);
      return conversation.conversationId;
    })();

    ensuringConversation.current = creationPromise;

    try {
      return await creationPromise;
    } finally {
      ensuringConversation.current = null;
    }
  };

  const newConversation = async () => {
    setActiveConversationId(null);
    await ensureConversation();
  };

  const sendUserMessage = async () => {
    if (!prompt.trim()) return;
    let conversationId: string | null = null;
    try {
      conversationId = await ensureConversation();
      console.debug("[chat] sending message for conversation", conversationId);
      setCurrentTurnId(conversationId, null);
      setConversationBusy(conversationId, true);
      await invoke("send_user_message", {
        conversationId,
        message: prompt,
      });
      setPrompt("");
    } catch (error) {
      if (conversationId) {
        setConversationBusy(conversationId, false);
        setCurrentTurnId(conversationId, null);
      }
      console.error("failed to start conversation", error);
    }
  };

  const interruptConversation = useCallback(async () => {
    if (!activeConversationId) {
      console.debug("[chat] interrupt requested with no active conversation");
      return;
    }
    const turnId = currentTurnIds[activeConversationId] ?? "";

    if (!turnId) {
      console.debug(
        "[chat] interrupt requested but no current turn id; clearing busy state",
        { conversationId: activeConversationId },
      );
      pendingInterrupts.current.add(activeConversationId);
      setConversationBusy(activeConversationId, false);
      setCurrentTurnId(activeConversationId, null);
      return;
    }
    try {
      await invoke("turn_interrupt", {
        threadId: activeConversationId,
        turnId,
      });
      // Now set busy state to false and turnId to null AFTER successful interrupt
      setConversationBusy(activeConversationId, false);
      setCurrentTurnId(activeConversationId, null);
      pendingInterrupts.current.delete(activeConversationId);
    } catch (error) {
      console.error("failed to interrupt conversation", error);
    }
  }, [activeConversationId, currentTurnIds, setConversationBusy, setCurrentTurnId]);

  const isBusy =
    activeConversationId && busyConversations[activeConversationId]
      ? true
      : false;

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-screen">
      <ResizablePanel
        defaultSize={24}
        className="flex h-full flex-col gap-3 border-r border-muted/20 bg-muted/10"
      >
        <ThreadSidebar />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={76} minSize={60}>
        <div className="flex h-full flex-col relative">
          <Button size="icon" onClick={newConversation}>
            <PencilIcon />
          </Button>
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <ApprovalRequestPanel />
            <ChatEvents events={events} />
          </div>
          {/* chat input  */}
          <div className="absolute bottom-0 w-full bg-background">
            <ChatInput
              prompt={prompt}
              onPromptChange={setPrompt}
              onSend={sendUserMessage}
              onInterrupt={interruptConversation}
              isBusy={isBusy}
              conversationId={activeConversationId}
            />
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
