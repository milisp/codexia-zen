import { ChatCompose } from "./ChatCompose";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BotMessageSquare } from "lucide-react";
import type { Message } from "@/types/Message";
import { useRef, useEffect } from "react";
import EventLog from "./EventLog";

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
  }, [activeMessages.length, activeMessages[activeMessages.length - 1]?.content, activeMessages[activeMessages.length - 1]?.events?.length]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b p-2">
        <h1 className="text-xl font-bold">Chat</h1>
      </header>
      <main className="flex flex-1 flex-col p-4 gap-4">
        <div className="flex-1 mb-2 flex flex-col">
          <ScrollArea className="flex-1">
            <div ref={scrollAreaRef}>
              {activeConversationId ? (
                activeMessages.map((msg, idx) => (
                  <div
                    key={String(msg.id) ?? `msg-${idx}`}
                    className={`mb-4 flex items-start gap-3 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="bg-primary rounded-full p-2">
                        <BotMessageSquare className="text-primary-foreground h-5 w-5" />
                      </div>
                    ) : (
                      <div className="w-8" />
                    )}
                    <div
                      className={`max-w-[80%] md:max-w-[60%] rounded-lg p-3 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="bg-muted rounded-lg p-3">
                          <div className="font-medium">🤖 Agent</div>
                          {msg.events && msg.events.length > 0 && (
                            <EventLog events={msg.events} />
                          )}
                          {msg.content && msg.content.trim() !== '' && (
                            <p className="text-sm whitespace-pre-wrap mt-2">{msg.content}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
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
        <div className="flex-none">
          <ChatCompose
            currentMessage={currentMessage}
            setCurrentMessage={setCurrentMessage}
            handleSendMessage={handleSendMessage}
            isSending={isSending}
            isInitializing={isInitializing}
            inputRef={inputRef}
          />
        </div>
      </main>
    </div>
  );
}
