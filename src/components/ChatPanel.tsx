import { ChatCompose } from "./ChatCompose";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BotMessageSquare } from "lucide-react";
import type { Message } from "@/bindings/Message";
import { useRef, useEffect } from "react";

interface ChatPanelProps {
  activeConversationId: string | null;
  activeMessages: Message[];
  currentMessage: string;
  setCurrentMessage: (msg: string) => void;
  handleSendMessage: () => void;
  isSending: boolean;
  isInitializing: boolean;
}

export function ChatPanel({
  activeConversationId,
  activeMessages,
  currentMessage,
  setCurrentMessage,
  handleSendMessage,
  isSending,
  isInitializing,
}: ChatPanelProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [activeMessages.length, activeMessages[activeMessages.length - 1]?.text]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b p-2">
        <h1 className="text-xl font-bold">Codexia Chat</h1>
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
                      msg.sender === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {msg.sender === "agent" ? (
                      <div className="bg-primary rounded-full p-2">
                        <BotMessageSquare className="text-primary-foreground h-5 w-5" />
                      </div>
                    ) : (
                      <div className="w-8" />
                    )}
                    <div
                      className={`max-w-[80%] md:max-w-[60%] rounded-lg p-3 ${
                        msg.sender === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
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
          />
        </div>
      </main>
    </div>
  );
}
