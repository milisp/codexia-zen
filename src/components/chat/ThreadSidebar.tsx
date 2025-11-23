import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Thread } from "@/bindings/v2/Thread";
import { RotateCw } from "lucide-react";

interface ThreadSidebarProps {
  isThreadLoading: boolean;
  loadThreads: (cursor?: string | null) => void;
  threadCursor: string | null;
  threads: Thread[];
  resumeStatus: string | null;
  onSelectThread: (thread: Thread) => void;
}

export function ThreadSidebar({
  isThreadLoading,
  loadThreads,
  threadCursor,
  threads,
  resumeStatus,
  onSelectThread,
}: ThreadSidebarProps) {
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
