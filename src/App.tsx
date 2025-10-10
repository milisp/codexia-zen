import './App.css';
import { ChatView } from '@/components/ChatView';
import { SidebarProvider } from '@/components/ui/sidebar';

export default function App() {

  return (
    <div className="bg-background text-foreground h-screen">
      <SidebarProvider className="h-full">
        <ChatView />
      </SidebarProvider>
    </div>
  );
}