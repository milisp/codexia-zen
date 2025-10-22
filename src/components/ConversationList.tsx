import { Button } from "@/components/ui/button";
import { Pencil, Trash2, MoreVertical } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConversationListStore } from "@/stores/useConversationListStore";
import { useConversationStore } from "@/stores/useConversationStore";
import { useCodexStore } from "@/stores/useCodexStore";

interface ConversationListProps {
  onNewTempConversation: () => void;
}

export function ConversationList({ onNewTempConversation }: ConversationListProps) {
  const { conversationsByCwd, activeConversationId, setActiveConversationId } = useConversationListStore();
  const { cwd } = useCodexStore();

  const conversations = (conversationsByCwd[cwd || ""] || []).slice().reverse();

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
              <DropdownMenu>
                <div className="flex items-center justify-between w-full">
                  <button
                    onClick={() => setActiveConversationId(conv.conversationId)}
                    className={`flex-grow text-left whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
                      activeConversationId === conv.conversationId
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {conv.preview}
                  </button>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="ml-1">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </div>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={async () => {
                      if (!conv.path) return;
                      try {
                        useConversationListStore
                          .getState()
                          .removeConversation(conv.conversationId);
                        useConversationStore
                          .getState()
                          .clearConversation(conv.conversationId);
                        await invoke("delete_file", { path: conv.path });
                      } catch (error) {
                        console.error("Failed to delete conversation file", error);
                      }
                    }}
                    className="text-red-600 px-1"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
