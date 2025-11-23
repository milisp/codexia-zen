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
import type { ThreadListParams } from "@/bindings/v2/ThreadListParams";
import type { ThreadListResponse } from "@/bindings/v2/ThreadListResponse";
import type { ThreadResumeParams } from "@/bindings/v2/ThreadResumeParams";
import type { ThreadResumeResponse } from "@/bindings/v2/ThreadResumeResponse";
import type { NewConversationParams } from "@/bindings/NewConversationParams";
import type { NewConversationResponse } from "@/bindings/NewConversationResponse";
import { StreamedEventNotification } from "@/types";
import {
  ThreadSidebar,
  ChatEvents,
  ChatInput,
  threadToEvents,
} from "@/components/chat";

export default function ChatPage() {
  const { cwd } = useCodexStore();
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadCursor, setThreadCursor] = useState<string | null>(null);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [resumeStatus, setResumeStatus] = useState<string | null>(null);

  const activeConversationId = useActiveConversationStore(
    (state) => state.activeConversationId,
  );
  const activeConversationIds = useActiveConversationStore(
    (state) => state.activeConversationIds,
  );
  const setActiveConversationId = useActiveConversationStore(
    (state) => state.setActiveConversationId,
  );

  const eventsByConversationId = useEventStore(
    (state) => state.eventsByConversationId,
  );
  const appendEvent = useEventStore((state) => state.appendEvent);
  const setConversationEvents = useEventStore(
    (state) => state.setConversationEvents,
  );
  const events = activeConversationId
    ? eventsByConversationId[activeConversationId] ?? []
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
        msg.type === "deprecation_notice"
      ) {
        return;
      }
      appendEvent(params);
      setActiveConversationId(params.conversationId);
    },
    [appendEvent, setActiveConversationId],
  );

  const loadThreads = useCallback(async (cursor: string | null = null) => {
    setIsThreadLoading(true);
    try {
      const params: ThreadListParams = {
        cursor,
        limit: 20,
        modelProviders: null,
      };
      const response = await invoke<ThreadListResponse>("list_threads", {
        params,
      });
      setThreadCursor(response.nextCursor);
      setThreads((prev) =>
        cursor ? [...prev, ...response.data] : response.data,
      );
    } catch (error) {
      console.error("failed to list threads", error);
    } finally {
      setIsThreadLoading(false);
    }
  }, []);

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

  useEffect(() => {
    loadThreads(null);
  }, [loadThreads]);

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
        console.debug("resume", response)
        const conversationId = response.thread.id;
        setResumeStatus(`Resumed ${response.thread.preview || response.thread.id}`);
        setConversationEvents(
          conversationId,
          threadToEvents(response.thread),
        );
        setActiveConversationId(conversationId);
        await invoke("add_conversation_listener", {
          conversationId,
        });
        loadThreads(null);
      } catch (error) {
        console.error("failed to resume thread", error);
        setResumeStatus("Failed to resume thread.");
      } finally {
        console.debug("resume", threadId)
      }
    },
    [loadThreads, setConversationEvents, setActiveConversationId],
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

  const buildConversationParams = (): NewConversationParams => ({
    model: "qwen2.5-coder:0.5b",
    modelProvider: "ollama",
    profile: "ollama",
    cwd: cwd ?? null,
    approvalPolicy: "on-request",
    sandbox: "workspace-write",
    config: null,
    baseInstructions: null,
    developerInstructions: null,
    compactPrompt: null,
    includeApplyPatchTool: true,
  });

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
          isThreadLoading={isThreadLoading}
          loadThreads={loadThreads}
          threadCursor={threadCursor}
          threads={threads}
          resumeStatus={resumeStatus}
          onSelectThread={handleThreadPreview}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={76} minSize={60}>
        <div className="flex h-full flex-col relative">
          <Button
            size="icon"
            onClick={newConversation}
          >
            <PencilIcon />
          </Button>
          <ChatEvents events={events} />
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
