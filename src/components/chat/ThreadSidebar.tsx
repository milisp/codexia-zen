import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Thread } from "@/bindings/v2/Thread";
import type { ThreadListParams } from "@/bindings/v2/ThreadListParams";
import type { ThreadListResponse } from "@/bindings/v2/ThreadListResponse";
import { invoke } from "@tauri-apps/api/core";
import { RotateCw } from "lucide-react";

interface ThreadSidebarProps {
  resumeStatus: string | null;
  onSelectThread: (thread: Thread) => void;
}

export function ThreadSidebar({
  resumeStatus,
  onSelectThread,
}: ThreadSidebarProps) {
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadCursor, setThreadCursor] = useState<string | null>(null);

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
    loadThreads(null);
  }, [loadThreads]);

  useEffect(() => {
    if (resumeStatus) {
      loadThreads(null);
    }
  }, [loadThreads, resumeStatus]);

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
                <button
                  type="button"
                  className="min-w-64 max-w-96 text-left text-sm hover:bg-gray-200"
                  onClick={() => onSelectThread(thread)}
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
