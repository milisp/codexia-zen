import "./App.css";
import { ChatContainer } from "@/components/chat/ChatContainer";

export default function App() {
  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      <ChatContainer />
    </div>
  );
}
