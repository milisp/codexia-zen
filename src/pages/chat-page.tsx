import { useCodexEvents } from '@/hooks/useCodexEvents';
import { ThreadList } from '@/components/ThreadList';
import { ChatInterface } from '@/components/ChatInterface';
import { ApprovalDialog } from '@/components/ApprovalDialog';

export function ChatPage() {
  // Listen to codex events
  useCodexEvents();
  return (
    <div className="flex h-screen">
      <ThreadList />
      <ChatInterface />
      <ApprovalDialog />
    </div>
  );
}
