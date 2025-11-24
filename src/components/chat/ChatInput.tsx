import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { Sandbox, ReasoningEffortSelector, ProviderModelSelector } from "../codexConfig";
import type { KeyboardEvent } from "react";

interface ChatInputProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
}

export function ChatInput({
  prompt,
  onPromptChange,
  onSend,
  sending,
}: ChatInputProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!prompt.trim() || sending) {
        return;
      }
      onSend();
    }
  };

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
          onClick={onSend}
          disabled={!prompt.trim() || sending}
        >
          <Send />
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
