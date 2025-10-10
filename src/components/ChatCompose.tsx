import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProviderModels } from "./provider-models";
import { Send } from "lucide-react";

interface ChatComposeProps {
  currentMessage: string;
  setCurrentMessage: (msg: string) => void;
  handleSendMessage: () => void;
  isSending: boolean;
  isInitializing: boolean;
}

export function ChatCompose({
  currentMessage,
  setCurrentMessage,
  handleSendMessage,
  isSending,
  isInitializing,
}: ChatComposeProps) {

  return (
    <div className="gap-2">
      <div className="flex items-center space-x-2">
        <Input
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
        <Button onClick={handleSendMessage} disabled={isSending || isInitializing}>
          {isSending ? "Sending..." : <Send />}
        </Button>
      </div>
      <div>
      <ProviderModels />
      </div>
    </div>
  );
}