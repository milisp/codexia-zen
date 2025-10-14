import { useRef } from "react";
import { useChatStore } from "@/stores/useChatStore";
import { useSessionStore } from "@/stores/useSessionStore";
import { useConversationStore } from "@/stores/useConversationStore";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ConversationList } from "./ConversationList";
import { ChatPanel } from "./ChatPanel";
import { useChatSession } from "@/hooks/useChatSession";

export function ChatView() {
  const chatInputRef = useRef<HTMLInputElement>(null);
  const { messages, currentMessage, setCurrentMessage } = useChatStore();
  const { activeConversationId } = useConversationStore();
  const { isInitializing } = useSessionStore();
  const { isSending, handleSendMessage } = useChatSession();

  const activeMessages = messages[activeConversationId || ""] || [];

  const focusChatInput = () => {
    chatInputRef.current?.focus();
  };

  const onSendMessage = () => {
    handleSendMessage(currentMessage);
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-screen">
      <ResizablePanel defaultSize={20}>
        <ConversationList onClearConversation={focusChatInput} />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel>
        <ChatPanel
          activeConversationId={activeConversationId}
          activeMessages={activeMessages}
          currentMessage={currentMessage}
          setCurrentMessage={setCurrentMessage}
          handleSendMessage={onSendMessage}
          isSending={isSending}
          isInitializing={isInitializing}
          inputRef={chatInputRef}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
