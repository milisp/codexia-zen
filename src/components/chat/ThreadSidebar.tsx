import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Thread } from "@/bindings/v2/Thread";
import type { ThreadListParams } from "@/bindings/v2/ThreadListParams";
import type { ThreadListResponse } from "@/bindings/v2/ThreadListResponse";
import type { ThreadResumeParams } from "@/bindings/v2/ThreadResumeParams";
import type { ThreadResumeResponse } from "@/bindings/v2/ThreadResumeResponse";
import { invoke } from "@tauri-apps/api/core";
import { RotateCw } from "lucide-react";
import { threadToEvents } from "./utils";
import { useActiveConversationStore } from "@/stores/useActiveConversationStore";
import { useEventStore } from "@/stores/useEventStore";

export function ThreadSidebar() {
  const { activeConversationIds, setActiveConversationId } =
    useActiveConversationStore();
  const { setConversationEvents } = useEventStore();
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadCursor, setThreadCursor] = useState<string | null>(null);
  const [resumeStatus, setResumeStatus] = useState<string | null>(null);

  const loadThreads = useCallback(async (cursor: string | null = null) => {
    const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
      new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error("list threads timeout"));
        }, ms);
        promise
          .then((value) => {
            clearTimeout(timer);
            resolve(value);
          })
          .catch((error) => {
            clearTimeout(timer);
            reject(error);
          });
      });

    setThreadError(null);
    setIsThreadLoading(true);
    try {
      const params: ThreadListParams = {
        cursor,
        limit: 20,
        modelProviders: null,
      };
      const response = await withTimeout(
        invoke<ThreadListResponse>("list_threads", {
          params,
        }),
        8000,
      );
      setThreadCursor(response.nextCursor ?? null);
      setThreads((prev) =>
        cursor ? [...prev, ...response.data] : response.data,
      );
    } catch (error) {
      console.error("failed to list threads", error);
      const message = error instanceof Error ? error.message : "failed to load threads";
      setThreadError(message);
      setThreadCursor(null);
      setThreads([]);
    } finally {
      setIsThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThreads(null);
  }, [loadThreads]);

  useEffect(() => {
    if (resumeStatus) {
      loadThreads(null);
    }
  }, [loadThreads, resumeStatus]);

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
    [setActiveConversationId, setConversationEvents],
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

  return (
    <>
      <div className="flex items-center justify-end">
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
          {threadError ? (
            <div className="flex flex-col gap-2 text-xs text-destructive">
              <p>Failed to load threads: {threadError}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => loadThreads(null)}
                disabled={isThreadLoading}
              >
                Retry
              </Button>
            </div>
          ) : isThreadLoading && threads.length === 0 ? (
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
                <button
                  type="button"
                  className="min-w-64 max-w-96 text-left text-sm hover:bg-gray-200"
                  onClick={() => handleThreadPreview(thread)}
                >
                  {thread.preview || "Untitled thread"}
                </button>
                <p className="text-xs text-muted-foreground">
                  {thread.modelProvider} •{" "}
                  {new Date(Number(thread.createdAt) * 1000).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      <div className="flex flex-col gap-2">
        {resumeStatus && <Badge className="text-xs">{resumeStatus}</Badge>}
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
    </>
  );
}
