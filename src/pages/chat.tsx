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
import { useCodexStore } from "@/stores/useCodexStore";
import { useActiveConversationStore } from "@/stores/useActiveConversationStore";
import { useEventStore } from "@/stores/useEventStore";
import type { Thread } from "@/bindings/v2/Thread";
import type { ThreadResumeParams } from "@/bindings/v2/ThreadResumeParams";
import type { ThreadResumeResponse } from "@/bindings/v2/ThreadResumeResponse";
import type { NewConversationResponse } from "@/bindings/NewConversationResponse";
import { StreamedEventNotification } from "@/types";
import {
  ThreadSidebar,
  ChatEvents,
  ChatInput,
  threadToEvents,
} from "@/components/chat";
import type { NewConversationParams } from "@/bindings/NewConversationParams";
import { getNewConversationParams } from "@/components/codexConfig/ConversationParams";
import { useSandboxStore } from "@/stores/useSandboxStore";
import { ApprovalRequestPanel } from "@/components/chat/ApprovalRequestCard";
export default function ChatPage() {
  const { cwd } = useCodexStore();
  const { mode, approvalPolicy } = useSandboxStore();
  const {
    selectedModel,
    reasoningEffort,
    selectedProvider: selectedProviderName,
  } = useCodexStore();
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [resumeStatus, setResumeStatus] = useState<string | null>(null);
  const {
    activeConversationId,
    activeConversationIds,
    setActiveConversationId,
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
    [appendEvent, setActiveConversationId],
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

  const handleResumeThread = useCallback(
    async (threadId: string) => {
      setResumeStatus(null);
      setActiveConversationId(null);
      try {
        const params: ThreadResumeParams = {
          threadId,
          history: null,
          path: null,
          model: null,
          modelProvider: null,
          cwd: null,
          approvalPolicy: null,
          sandbox: null,
          config: null,
          baseInstructions: null,
          developerInstructions: null,
        };
        const response = await invoke<ThreadResumeResponse>("resume_thread", {
          params,
        });
        console.debug("resume", response);
        const conversationId = response.thread.id;
        setResumeStatus(
          `Resumed ${response.thread.preview || response.thread.id}`,
        );
        setConversationEvents(conversationId, threadToEvents(response.thread));
        setActiveConversationId(conversationId);
        await invoke("add_conversation_listener", {
          conversationId,
        });
      } catch (error) {
        console.error("failed to resume thread", error);
        setResumeStatus("Failed to resume thread.");
      } finally {
        console.debug("resume", threadId);
      }
    },
    [setConversationEvents, setActiveConversationId],
  );

  const handleThreadPreview = useCallback(
    (thread: Thread) => {
      if (activeConversationIds.includes(thread.id)) {
        setActiveConversationId(thread.id);
        return;
      }

      handleResumeThread(thread.id);
    },
    [activeConversationIds, handleResumeThread, setActiveConversationId],
  );

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
    setSending(true);
    try {
      const conversationId = await ensureConversation();
      await invoke("send_user_message", {
        conversationId: conversationId,
        message: prompt,
      });
      setPrompt("");
    } catch (error) {
      console.error("failed to start conversation", error);
    } finally {
      setSending(false);
    }
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-screen">
      <ResizablePanel
        defaultSize={24}
        className="flex h-full flex-col gap-3 border-r border-muted/20 bg-muted/10"
      >
        <ThreadSidebar
          resumeStatus={resumeStatus}
          onSelectThread={handleThreadPreview}
        />
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
              sending={sending}
            />
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
