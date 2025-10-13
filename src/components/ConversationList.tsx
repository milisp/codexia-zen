import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { useConversationStore } from "@/stores/useConversationStore";
import { ConversationSummary } from "@/bindings/ConversationSummary";
import { useChatStore } from "@/stores/useChatStore";

interface ConversationListProps {
  onClearConversation: () => void;
}

export function ConversationList({ onClearConversation }: ConversationListProps) {
  const { conversations, activeConversationId, setActiveConversationId } = useConversationStore();
  const { clearMessages } = useChatStore();

  const handleClearConversation = () => {
    if (activeConversationId) {
      clearMessages(activeConversationId);
    }
    setActiveConversationId(null);
    onClearConversation();
  };

  return (
    <nav className="flex flex-col h-full bg-muted/30 p-4">
      <div className="mb-4">
        <div className="flex items-center justify-between w-full mb-2">
          <h2 className="text-lg font-semibold">History</h2>
          <Button variant="ghost" size="icon" onClick={handleClearConversation}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
        <ul className="space-y-1">
          {conversations?.map((conv: ConversationSummary, idx: number) => (
            <li key={conv.conversationId ?? `conv-${idx}`}>
              <button
                className={`flex w-full items-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
                  activeConversationId === conv.conversationId
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {conv.preview}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
