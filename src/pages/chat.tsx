import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ConversationList } from "@/components/ConversationList";
import { ChatPanel } from "@/components/ChatPanel";
import { useChatSession } from "@/hooks/useChatSession";

export default function ChatPage() {
  const {
    textAreaRef,
    activeConversationId,
    activeEvents,
    activeDeltaEvents,
    currentMessage,
    setCurrentMessage,
    handleSendMessage,
    isSending,
    isInitializing,
    canCompose,
    handlePrepareNewConversation,
  } = useChatSession();

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-screen">
      <ResizablePanel defaultSize={20}>
        <ConversationList
          onNewTempConversation={handlePrepareNewConversation}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel>
        <ChatPanel
          conversationId={activeConversationId}
          events={activeEvents}
          deltaEvents={activeDeltaEvents}
          currentMessage={currentMessage}
          setCurrentMessage={setCurrentMessage}
          handleSendMessage={handleSendMessage}
          isSending={isSending}
          isInitializing={isInitializing}
          canCompose={canCompose}
          textAreaRef={textAreaRef}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
