import { useRef } from "react";
import { useConversationStore } from "@/stores/useConversationStore";
import { useSessionStore } from "@/stores/useSessionStore";
import { useConversationListStore } from "@/stores/useConversationListStore";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ConversationList } from "@/components/ConversationList";
import { ChatPanel } from "@/components/ChatPanel";
import { useChatSession } from "@/hooks/useChatSession";

export default function ChatPage() {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const { messages, currentMessage, setCurrentMessage } =
    useConversationStore();
  const { activeConversationId } = useConversationListStore();
  const { isInitializing } = useSessionStore();
  const { isSending, handleSendMessage, handleNewConversation } =
    useChatSession();

  const activeMessages = messages[activeConversationId || ""] || [];

  const focusChatInput = () => {
    textAreaRef.current?.focus();
  };

  const handleNewConversationAndFocus = () => {
    handleNewConversation();
    focusChatInput();
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-screen">
      <ResizablePanel defaultSize={20}>
        <ConversationList
          onNewTempConversation={handleNewConversationAndFocus}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel>
        <ChatPanel
          activeConversationId={activeConversationId}
          activeMessages={activeMessages}
          currentMessage={currentMessage}
          setCurrentMessage={setCurrentMessage}
          handleSendMessage={() => handleSendMessage(currentMessage)}
          isSending={isSending}
          isInitializing={isInitializing}
          textAreaRef={textAreaRef}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
