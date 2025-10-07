import { FormEvent, KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => Promise<void> | void;
  disabled?: boolean;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  disabled,
}: ChatComposerProps) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (value.trim().length === 0 || disabled) return;
    await onSubmit();
  }

  async function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter") {
      if (event.shiftKey) {
        return;
      } else {
        event.preventDefault();
        if (value.trim().length === 0 || disabled) return;
        await onSubmit();
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border bg-background shadow-sm"
    >
      <div className="relative w-full">
        <textarea
          id="chat-composer"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask codex to do anything"
          className={cn(
            "min-h-[96px] w-full resize-y rounded-xl border border-border/80 bg-muted/40 py-3 pl-4 pr-14 text-sm leading-6 shadow-inner",
            "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus:outline-none",
          )}
          disabled={disabled}
        />
        <Button
          type="submit"
          size="icon"
          className="absolute bottom-3 right-3"
          disabled={disabled || value.trim().length === 0}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
