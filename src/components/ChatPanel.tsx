import { ChatCompose } from "./ChatCompose";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRef, useEffect } from "react";
import EventLog from "./EventLog";
import { Message } from "@/types/Message";

interface ChatPanelProps {
  activeConversationId: string | null;
  activeMessages: Message[];
  currentMessage: string;
  setCurrentMessage: (msg: string) => void;
  handleSendMessage: () => void;
  isSending: boolean;
  isInitializing: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export function ChatPanel({
  activeConversationId,
  activeMessages,
  currentMessage,
  setCurrentMessage,
  handleSendMessage,
  isSending,
  isInitializing,
  inputRef,
}: ChatPanelProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [
    activeMessages.length,
    activeMessages[activeMessages.length - 1]?.content,
    activeMessages[activeMessages.length - 1]?.events?.length,
  ]);

  return (
    <div className="flex h-full flex-col">
      <main className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
        <div className="flex-1 mb-2 flex flex-col">
          <ScrollArea className="flex-1">
            <div ref={scrollAreaRef}>
              {activeConversationId || activeMessages.length > 0 ? (
                activeMessages.map((msg, idx) => (
                  <div
                    key={String(msg.id) ?? `msg-${idx}`}
                    className={`mb-4 flex items-start gap-3 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`w-[90%] rounded-lg p-3 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="bg-muted rounded-lg">
                          {msg.events && msg.events.length > 0 && (
                            <EventLog events={msg.events} />
                          )}
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Select a conversation or start a new one.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </main>
      <div className="sticky bottom-0 left-0 right-0 bg-background border-t">
        <ChatCompose
          currentMessage={currentMessage}
          setCurrentMessage={setCurrentMessage}
          handleSendMessage={handleSendMessage}
          isSending={isSending}
          isInitializing={isInitializing}
          inputRef={inputRef}
        />
      </div>
    </div>
  );
}
