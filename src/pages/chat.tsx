import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { PencilIcon } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState, useCallback } from "react";
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
  const events = activeConversationId
    ? (eventsByConversationId[activeConversationId] ?? [])
    : [];

  const addEvent = useCallback(
    (notification: StreamedEventNotification) => {
      const { params } = notification;
      if (!params.conversationId || !params.id || !params.msg) {
        return;
      }
      const { msg } = params;
      setCurrentTurnId(params.conversationId, params.id);
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
    [appendEvent, setActiveConversationId, setConversationBusy],
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

    return () => {
      unlistenConversation.then((fn) => fn());
    };
  }, [addEvent]);

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
    const params = buildConversationParams();
    const conversation = await invoke<NewConversationResponse>(
      "new_conversation",
      { params },
    );
    setConversationEvents(conversation.conversationId, []);
    setActiveConversationId(conversation.conversationId);
    await invoke("add_conversation_listener", {
      conversationId: conversation.conversationId,
    });
    return conversation.conversationId;
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
      console.error("failed to start conversation", error);
    } finally {
      if (conversationId) {
        console.debug(
          "[chat] clearing busy after send completion for conversation",
          conversationId,
        );
        setConversationBusy(conversationId, false);
      }
    }
  };

  const interruptConversation = useCallback(async () => {
    if (!activeConversationId) {
      console.debug("[chat] interrupt requested with no active conversation");
      return;
    }
    const turnId = currentTurnIds[activeConversationId] ?? "";
    if (!turnId) {
      return;
    }
    try {
      await invoke("turn_interrupt", {
        threadId: activeConversationId,
        turnId,
      });
      setConversationBusy(activeConversationId, false);
    } catch (error) {
      setConversationBusy(activeConversationId, false);
      console.error("failed to interrupt conversation", error);
    }
  }, [activeConversationId, currentTurnIds, setConversationBusy]);

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
            />
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
