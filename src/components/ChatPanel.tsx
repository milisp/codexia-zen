import { useEffect, useRef, type RefObject } from "react";
import { ChatCompose } from "@/components/ChatCompose";
import DeltaEventLog from "@/components/DeltaEventLog";
import { EventItem } from "@/components/EventItem";
import type { ConversationEvent, EventWithId } from "@/types/chat";

interface ChatPanelProps {
  conversationId: string | null;
  events: ConversationEvent[];
  deltaEvents: EventWithId[];
  currentMessage: string;
  setCurrentMessage: (value: string) => void;
  handleSendMessage: () => void;
  isSending: boolean;
  isInitializing: boolean;
  canCompose: boolean;
  textAreaRef: RefObject<HTMLTextAreaElement | null>;
}

export function ChatPanel({
  conversationId,
  events,
  deltaEvents,
  currentMessage,
  setCurrentMessage,
  handleSendMessage,
  isSending,
  isInitializing,
  canCompose,
  textAreaRef,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [events, deltaEvents]);

  const composerDisabled =
    isInitializing || isSending || !canCompose;

  const hasContent = events.length > 0 || deltaEvents.length > 0;
  const shouldShowEmptyState = !conversationId || !hasContent;
  const emptyStateMessage = canCompose
    ? "Send a message to start the conversation."
    : "Choose a project before starting a conversation.";

  return (
    <div className="flex h-full flex-col">
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-6 py-4"
      >
        {shouldShowEmptyState ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {emptyStateMessage}
          </div>
        ) : (
          <>
            {events.map((event) => {
              return (
                <EventItem
                  key={event.id}
                  event={event}
                  conversationId={conversationId}
                />
              );
            })}

            {deltaEvents.length > 0 && (
              <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm shadow-sm">
                <div className="text-xs font-medium uppercase text-muted-foreground mb-2">
                  Streaming updates
                </div>
                <DeltaEventLog events={deltaEvents} />
              </div>
            )}
          </>
        )}
      </div>
      <div className="border-t bg-background p-4">
        <ChatCompose
          currentMessage={currentMessage}
          setCurrentMessage={setCurrentMessage}
          handleSendMessage={handleSendMessage}
          isSending={isSending}
          isInitializing={composerDisabled}
          textAreaRef={textAreaRef}
        />
      </div>
    </div>
  );
}
