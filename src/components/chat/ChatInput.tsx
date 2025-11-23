import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

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
  return (
    <div className="flex gap-3 mt-3 shrink-0 px-4 pb-4">
      <Textarea
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        placeholder="Ask Codex to do anything..."
        className="h-12 resize-none"
      />
      <Button
        variant="default"
        size="icon"
        onClick={onSend}
        disabled={!prompt.trim() || sending}
      >
        <Send />
      </Button>
    </div>
  );
}
