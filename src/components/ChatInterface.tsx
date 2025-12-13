import { useState, useRef, useEffect } from 'react';
import { useCodexStore } from '@/stores/useCodexStore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SendIcon, Square } from 'lucide-react';
import { renderEvent } from './EventItem';

export function ChatInterface() {
  const {
    currentThreadId,
    currentTurnId,
    isProcessing,
    events,
    turnStart,
    turnInterrupt,
  } = useCodexStore();

  const [inputMessage, setInputMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get events for the current thread
  const currentThreadEvents = currentThreadId ? events[currentThreadId] || [] : [];

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentThreadEvents]);

  const handleSend = async () => {
    if (!inputMessage.trim() || !currentThreadId || isProcessing) return;

    const message = inputMessage.trim();
    setInputMessage('');

    try {
      await turnStart(currentThreadId, message);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleStop = async () => {
    if (!currentThreadId || !currentTurnId) return;

    try {
      await turnInterrupt(currentThreadId, currentTurnId);
    } catch (error) {
      console.error('Failed to stop turn:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
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
      <div className="border-t p-4 bg-background">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              currentThreadId
                ? 'Type your message... (Enter to send, Shift+Enter for new line)'
                : 'Select a thread first'
            }
            className="min-h-[60px] max-h-[200px] resize-none"
            disabled={!currentThreadId}
          />
          {isProcessing ? (
            <Button onClick={handleStop} variant="destructive" size="icon" className="h-[60px]">
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={!inputMessage.trim() || !currentThreadId}
              size="icon"
              className="h-[60px]"
            >
              <SendIcon className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
