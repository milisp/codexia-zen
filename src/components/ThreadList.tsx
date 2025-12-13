import { useCodexStore } from '@/stores/useCodexStore';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PencilLine } from 'lucide-react';
import type { ThreadStartParams } from '@/bindings/v2/ThreadStartParams';
import { useConfigStore } from '@/stores/useConfigStore';

export function ThreadList() {
  const { threads, currentThreadId, threadStart, setCurrentThread } =
    useCodexStore();
  const { sandbox, approvalPolicy, modelPerProvider, modelProvider, reasoningEffort, cwd } = useConfigStore();

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

  return (
    <div className="w-64 border-r flex flex-col bg-muted/30">
      {/* Header */}
      <div className="flex px-2 justify-end">
        <Button variant="outline" onClick={handleNewThread} size="icon">
          <PencilLine />
        </Button>
      </div>

      {/* Thread List */}
      <ScrollArea className="flex-1">
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
