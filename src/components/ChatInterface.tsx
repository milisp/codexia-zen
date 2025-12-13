import { useRef, useEffect } from 'react';
import { useCodexStore } from '@/stores/useCodexStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { renderEvent } from './EventItem';
import { InputArea } from './InputArea';
import { ProfilePopover } from './ProfilePopover';
import { SandboxPolicyPopover } from './SandboxPolicyPopover';
import { ReasoningEffortPopover } from './ReasoningEffortPopover';
import { AppHeader } from './AppHeader';

export function ChatInterface() {
  const {
    currentThreadId,
    currentTurnId,
    isProcessing,
    events,
    turnStart,
    turnInterrupt,
  } = useCodexStore();

  const scrollRef = useRef<HTMLDivElement>(null);

  // Get events for the current thread
  const currentThreadEvents = currentThreadId ? events[currentThreadId] || [] : [];

  // Debug logging
  useEffect(() => {
    console.log('[ChatInterface] currentThreadId changed:', currentThreadId);
    console.log('[ChatInterface] events for thread:', currentThreadEvents);
    console.log('[ChatInterface] all events:', events);
  }, [currentThreadId, currentThreadEvents, events]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentThreadEvents]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <AppHeader />
      {/* Messages Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full px-4" ref={scrollRef}>
          {!currentThreadId ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Select or create a thread to start chatting
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-2">
              {currentThreadEvents.map((event, index) => renderEvent(event, index))}
              {isProcessing && (
                <div className="text-sm text-muted-foreground animate-pulse">
                  thinking...
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Input Area */}
      <InputArea
        currentThreadId={currentThreadId}
        currentTurnId={currentTurnId}
        isProcessing={isProcessing}
        onSend={async (message) => {
          if (!currentThreadId) return;
          await turnStart(currentThreadId, message);
        }}
        onStop={async () => {
          if (!currentThreadId || !currentTurnId) return;
          await turnInterrupt(currentThreadId, currentTurnId);
        }}
      />

      {/* Configuration Popovers */}
      <div className="flex gap-2 px-4 py-2 border-t">
        <SandboxPolicyPopover />
        <ProfilePopover />
        <ReasoningEffortPopover />
      </div>
    </div>
  );
}
