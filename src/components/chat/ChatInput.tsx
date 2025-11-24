import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, CircleStop } from "lucide-react";
import { Sandbox, ReasoningEffortSelector, ProviderModelSelector } from "../codexConfig";
import type { KeyboardEvent } from "react";

interface ChatInputProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSend: () => void;
  onInterrupt?: () => void;
  isBusy: boolean;
  conversationId: string | null;
}

export function ChatInput({
  prompt,
  onPromptChange,
  onSend,
  onInterrupt,
  isBusy,
  conversationId,
}: ChatInputProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!prompt.trim() || isBusy) {
        console.debug("chat input submit blocked", {
          promptLength: prompt.trim().length,
          isBusy,
          conversationId,
        });
        return;
      }
      onSend();
    }
  };

  const handleClick = () => {
    console.debug("chat input clicked", {
      isBusy,
      promptLength: prompt.trim().length,
      conversationId,
    });
    if (isBusy) {
      console.info("chat input interrupt requested");
      onInterrupt?.();
      return;
    }
    if (!prompt.trim()) {
      return;
    }
    onSend();
  };

  const isButtonDisabled = isBusy ? false : !prompt.trim();

  return (
    <>
      <div className="flex gap-3 mt-3 shrink-0 px-4">
        <Textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Codex to do anything..."
          className="h-12"
        />
        <Button
          size="icon"
          onClick={handleClick}
          disabled={isButtonDisabled}
        >
          {isBusy ? <CircleStop className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex items-center px-4">
        <Sandbox />
        <ProviderModelSelector />
        <ReasoningEffortSelector />
      </div>
    </>
  );
}
