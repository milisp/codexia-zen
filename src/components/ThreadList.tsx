import { useCodexStore } from '@/stores/useCodexStore';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PencilLine, RefreshCw } from 'lucide-react';
import type { ThreadStartParams } from '@/bindings/v2/ThreadStartParams';
import type { ThreadListParams } from '@/bindings/v2/ThreadListParams';
import type { ThreadListResponse } from '@/bindings/v2/ThreadListResponse';
import { useConfigStore } from '@/stores/useConfigStore';
import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';

export function ThreadList() {
  const { threads, currentThreadId, threadStart, setCurrentThread, setThreads } =
    useCodexStore();
  const { sandbox, approvalPolicy, modelPerProvider, modelProvider, reasoningEffort, cwd } = useConfigStore();
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);

  const handleNewThread = async () => {
    try {
      const params: ThreadStartParams = {
        model: modelPerProvider[modelProvider],
        modelProvider: modelProvider,
        cwd: cwd,
        approvalPolicy: approvalPolicy,
        sandbox: sandbox,
        baseInstructions: null,
        developerInstructions: null,
        config: {
          "model_reasoning_effort": reasoningEffort,
          "show_raw_agent_reasoning": true,
          "model_reasoning_summary": "auto",
        }
      }
      const result = await threadStart(params);
      console.log('[ThreadList] threadStart() completed:', result);
    } catch (error) {
      console.error('[ThreadList] Failed to start new thread:', error);
    }
  };

  const handleSelectThread = async (threadId: string) => {
    if (threadId === currentThreadId) return;

    try {
      await setCurrentThread(threadId);
    } catch (error) {
      console.error('Failed to switch thread:', error);
    }
  };

  const loadThreads = async () => {
    try {
      setIsLoadingThreads(true);
      const params: ThreadListParams = {
        cursor: null,
        limit: 20,
        modelProviders: null,
      };
      const response = await invoke<ThreadListResponse>('thread_list', { params });
      console.log('[ThreadList] Loaded threads:', response.data);
      setThreads(response.data);
    } catch (error) {
      console.error('[ThreadList] Failed to load threads:', error);
    } finally {
      setIsLoadingThreads(false);
    }
  };

  useEffect(() => {
    loadThreads();
  }, []);

  return (
    <div className="w-64 border-r flex flex-col bg-muted/30 h-screen">
      {/* Header */}
      <div className="flex px-2 justify-end gap-2">
        <Button
          variant="outline"
          onClick={loadThreads}
          size="icon"
          disabled={isLoadingThreads}
        >
          <RefreshCw className={isLoadingThreads ? 'animate-spin' : ''} />
        </Button>
        <Button variant="outline" onClick={handleNewThread} size="icon">
          <PencilLine />
        </Button>
      </div>

      {/* Thread List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1">
          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => handleSelectThread(thread.id)}
              className={`w-full text-left p-3 rounded-lg hover:bg-accent transition-colors ${
                currentThreadId === thread.id ? 'bg-accent' : ''
              }`}
            >
              <div className="text-sm font-medium truncate">{thread.preview}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(thread.createdAt * 1000).toLocaleDateString()} - 
                {thread.id}
              </div>
            </button>
          ))}
          {threads.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              No threads yet.
              <br />
              Create a new one to get started.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
