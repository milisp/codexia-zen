import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SendIcon, Square } from 'lucide-react';

interface InputAreaProps {
  currentThreadId: string | null;
  currentTurnId: string | null;
  isProcessing: boolean;
  onSend: (message: string) => Promise<void>;
  onStop: () => Promise<void>;
}

export function InputArea({
  currentThreadId,
  currentTurnId,
  isProcessing,
  onSend,
  onStop,
}: InputAreaProps) {
  const [inputMessage, setInputMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (!inputMessage.trim() || !currentThreadId || isProcessing) return;

    const message = inputMessage.trim();
    setInputMessage('');

    try {
      await onSend(message);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleStop = async () => {
    if (!currentThreadId || !currentTurnId) return;

    try {
      await onStop();
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
  );
}
