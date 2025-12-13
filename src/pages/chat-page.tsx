import { useCodexEvents } from '@/hooks/useCodexEvents';
import { ThreadList } from '@/components/ThreadList';
import { ChatInterface } from '@/components/ChatInterface';
import { ApprovalDialog } from '@/components/ApprovalDialog';
import { useLayoutStore } from '@/stores/useLayoutStore';

export function ChatPage() {
  // Listen to codex events
  useCodexEvents();

  const { sidebarOpen } = useLayoutStore()
  return (
    <div className="flex h-screen">
      {sidebarOpen && <ThreadList />}
      <ChatInterface />
      <ApprovalDialog />
    </div>
  );
}
