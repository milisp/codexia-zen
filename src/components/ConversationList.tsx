import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { useConversationStore } from "@/stores/useConversationStore";
import { ConversationSummary } from "@/bindings/ConversationSummary";
import { useChatStore } from "@/stores/useChatStore";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useSessionStore } from "@/stores/useSessionStore";
import { Message } from "@/bindings/Message";

interface ConversationListProps {
  handleNewConversation: () => void;
}

export function ConversationList({
  handleNewConversation,
}: ConversationListProps) {
  const { conversations, activeConversationId, setActiveConversationId } = useConversationStore();
  const { messages } = useChatStore();
  const { sessionId } = useSessionStore();

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    if (messages[id]?.length > 0) {
      return;
    }
    invoke<Message[]>("get_conversation_history", { sessionId, conversationId: id })
      .then((history) => {
        console.log(`History for conversation ${id}:`, history); // Added log
        if (id) {
          const newMessages = { ...messages, [id]: history };
          useChatStore.setState({ messages: newMessages });
        }
      })
      .catch((err) => {
        console.error(`Failed to get history for ${id}:`, err);
        toast.error(`Failed to get history for ${id}: ${err}`);
      });
  };

  return (
    <nav className="flex flex-col h-full bg-muted/30 p-4">
      <div className="mb-4">
        <div className="flex items-center justify-between w-full mb-2">
          <h2 className="text-lg font-semibold">History</h2>
          <Button variant="ghost" size="icon" onClick={handleNewConversation}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
        <ul className="space-y-1">
          {conversations?.map((conv: ConversationSummary, idx: number) => (
            <li key={conv.conversationId ?? `conv-${idx}`}>
              <button
                className={`flex w-full items-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
                  activeConversationId === conv.conversationId ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                }`}
                onClick={() => handleSelectConversation(conv.conversationId)}
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
