import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { useConversationStore } from "@/stores/useConversationStore";
import { useCodexStore } from "@/stores/useCodexStore";

interface ConversationListProps {
  onNewTempConversation: () => void;
}

export function ConversationList({ onNewTempConversation }: ConversationListProps) {
  const { conversationsByCwd, activeConversationId, setActiveConversationId } = useConversationStore();
  const { cwd } = useCodexStore();

  const conversations = conversationsByCwd[cwd || ""] || [];

  const handleNewTempConversation = () => {
    onNewTempConversation();
  };

  return (
    <nav className="flex flex-col h-full bg-muted/30 p-4">
      <div className="mb-4">
        <div className="flex items-center justify-between w-full mb-2">
          <h2 className="text-lg font-semibold">History</h2>
          <Button variant="ghost" size="icon" onClick={handleNewTempConversation}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
        <ul className="space-y-1">
          {conversations.map((conv) => (
            <li key={conv.conversationId}>
              <button
                className={`flex w-full items-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
                  activeConversationId === conv.conversationId
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                }`}
                onClick={() => setActiveConversationId(conv.conversationId)}
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
