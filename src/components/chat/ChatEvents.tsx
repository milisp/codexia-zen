import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { EventMsg } from "@/bindings/EventMsg";
import type { StreamedEventNotification } from "@/types";

interface ChatEventsProps {
  events: StreamedEventNotification["params"][];
}

export function ChatEvents({ events }: ChatEventsProps) {
  return (
    <ScrollArea className="flex-1 bg-muted/20 rounded-lg pb-[80px] h-full">
      <div className="space-y-3 p-4">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Start a conversation to stream Codex events here.
          </p>
        ) : (
          events.map((item, index) => (
            <div
              key={index}
              className="rounded-md border bg-background p-3 shadow-sm"
            >
              {renderEventSummary(item.msg)}
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}

function renderEventSummary(msg: EventMsg) {
  switch (msg.type) {
    case "agent_message":
    case "user_message":
      return <p className="text-sm font-medium">{msg.message}</p>;
    case "error":
      return <Badge>{msg.message}</Badge>;
    case "task_complete":
      return (
        <p className="text-sm font-medium text-green-600">Task complete</p>
      );
    case "item_started":
    case "item_completed":
    case "deprecation_notice":
    case "task_started":
    case "token_count":
      return null;
    default:
      return (
        <p className="text-xs text-muted-foreground">{msg.type}</p>
      );
  }
}
