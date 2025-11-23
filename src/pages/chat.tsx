import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PencilIcon, RotateCw, Send, Play } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState, useCallback } from "react";
import { useCodexStore } from "@/stores/useCodexStore";
import type { EventMsg } from "@/bindings/EventMsg";
import type { Thread } from "@/bindings/v2/Thread";
import type { ThreadItem } from "@/bindings/v2/ThreadItem";
import type { ThreadListParams } from "@/bindings/v2/ThreadListParams";
import type { ThreadListResponse } from "@/bindings/v2/ThreadListResponse";
import type { ThreadResumeParams } from "@/bindings/v2/ThreadResumeParams";
import type { ThreadResumeResponse } from "@/bindings/v2/ThreadResumeResponse";
import type { NewConversationParams } from "@/bindings/NewConversationParams";
import type { NewConversationResponse } from "@/bindings/NewConversationResponse";

type StreamedEventNotification = {
  method: string;
  params: {
    conversationId: string;
    id: string;
    msg: EventMsg;
  };
};

export default function ChatPage() {
  const { cwd } = useCodexStore();
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [events, setEvents] = useState<StreamedEventNotification["params"][]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadCursor, setThreadCursor] = useState<string | null>(null);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [resumingThreadId, setResumingThreadId] = useState<string | null>(null);
  const [resumeStatus, setResumeStatus] = useState<string | null>(null);

  const addEvent = useCallback((notification: StreamedEventNotification) => {
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
    setActiveConversationId(params.conversationId);
    setEvents((prev) => [...prev, params]);
  }, []);

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
      setResumingThreadId(threadId);
      setResumeStatus(null);
      setEvents([]);
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
        setEvents(threadToEvents(response.thread));
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
        setResumingThreadId(null);
      }
    },
    [loadThreads],
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
    setActiveConversationId(conversation.conversationId);
    await invoke("add_conversation_listener", {
      conversationId: conversation.conversationId,
    });
    return conversation.conversationId;
  };

  const newConversation = async () => {
    setEvents([]);
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
        className="flex h-full flex-col gap-3 border-r border-muted/20 bg-muted/10 px-3 py-3"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Saved sessions
          </p>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => loadThreads(null)}
            disabled={isThreadLoading}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 overflow-hidden rounded-md border border-border bg-background">
          <div className="space-y-2 p-2">
            {isThreadLoading && threads.length === 0 ? (
              <p className="text-xs text-muted-foreground">Loading threads…</p>
            ) : threads.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No saved threads yet.
              </p>
            ) : (
              threads.map((thread) => (
                <div
                  key={thread.id}
                  className="flex flex-col space-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {thread.preview || "Untitled thread"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleResumeThread(thread.id)}
                      disabled={resumingThreadId === thread.id}
                    >
                      <Play size={10} />
                    </Button>
                    {thread.modelProvider} •{" "}
                    {new Date(Number(thread.createdAt) * 1000).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        <div className="flex flex-col gap-2">
          {resumeStatus && (
            <Badge className="text-xs">{resumeStatus}</Badge>
          )}
          {threadCursor && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadThreads(threadCursor)}
              disabled={isThreadLoading}
            >
              {isThreadLoading ? "Loading…" : "Load more"}
            </Button>
          )}
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={80} minSize={60}>
        <div className="flex h-full flex-col relative">
          <Button
            size="icon"
            onClick={newConversation}
          >
            <PencilIcon />
          </Button>
          <ScrollArea className="flex-1 bg-muted/20 rounded-lg pb-[80px] h-full">
            <div className="space-y-3 p-4">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Start a conversation to stream Codex events here.
                </p>
              ) : (
                events.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-md border bg-background p-3 shadow-sm"
                  >
                    {renderEventSummary(item.msg)}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          {/* chat input  */}
          <div className="absolute bottom-0 w-full bg-background">
            <div className="flex gap-3 mt-3 shrink-0 px-4 pb-4">
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ask Codex to do anything..."
                className="h-12 resize-none"
              />
              <Button
                variant="default"
                size="icon"
                onClick={sendUserMessage}
                disabled={!prompt.trim() || sending}
              >
                <Send />
              </Button>
            </div>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function renderEventSummary(msg: EventMsg) {
  switch (msg.type) {
    case "agent_message":
    case "user_message":
      return <p className="text-sm font-medium">{msg.message}</p>;
    case "error":
      return (
        <Badge>{msg.message}</Badge>
      );
    case "task_complete":
      return (
        <p className="text-sm font-medium text-green-600">Task complete</p>
      );
    case "item_started":
    case "item_completed":
    case "deprecation_notice":
    case "task_started":
    case "token_count":
      return null
    default:
      return (
        <p className="text-xs text-muted-foreground">
          {msg.type}
        </p>
      );
  }
}

function threadToEvents(
  thread: Thread,
): StreamedEventNotification["params"][] {
  const events: StreamedEventNotification["params"][] = [];

  for (const turn of thread.turns) {
    for (const item of turn.items) {
      const msg = convertThreadItemToEventMsg(item);
      if (!msg) {
        continue;
      }

      events.push({
        conversationId: thread.id,
        id: item.id,
        msg,
      });
    }
  }

  return events;
}

function convertThreadItemToEventMsg(item: ThreadItem): EventMsg | null {
  switch (item.type) {
    case "agentMessage":
      return { type: "agent_message", message: item.text };
    case "userMessage": {
      const parts: string[] = [];
      const images: string[] = [];

      for (const input of item.content) {
        switch (input.type) {
          case "text":
            parts.push(input.text);
            break;
          case "image":
            parts.push(`Image: ${input.url}`);
            images.push(input.url);
            break;
          case "localImage":
            parts.push(`Image: ${input.path}`);
            images.push(input.path);
            break;
        }
      }

      return {
        type: "user_message",
        message: parts.length > 0 ? parts.join("\n") : "User message",
        images: images.length > 0 ? images : null,
      };
    }
    default:
      return null;
  }
}
