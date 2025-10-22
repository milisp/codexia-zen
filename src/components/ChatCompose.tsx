import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ProviderModels } from "./config/provider-models";
import { Send } from "lucide-react";
import { Sandbox } from "./config/Sandbox";
import { ReasoningEffortSelector } from "./config/ReasoningEffortSelector";

interface ChatComposeProps {
  currentMessage: string;
  setCurrentMessage: (msg: string) => void;
  handleSendMessage: () => void;
  isSending: boolean;
  isInitializing: boolean;
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function ChatCompose({
  currentMessage,
  setCurrentMessage,
  handleSendMessage,
  isSending,
  isInitializing,
  textAreaRef,
}: ChatComposeProps) {
  return (
    <div className="gap-2">
      <div className="flex items-center space-x-2">
        <Textarea
          ref={textAreaRef}
          placeholder="Type your message..."
          value={currentMessage}
          onChange={(e) => setCurrentMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          disabled={isSending || isInitializing}
        />
        <Button
          onClick={handleSendMessage}
          disabled={isSending || isInitializing}
        >
          {isSending ? "Sending..." : <Send />}
        </Button>
      </div>
      <div>
        <Sandbox />
        <ProviderModels />
        <ReasoningEffortSelector />
      </div>
    </div>
  );
}
