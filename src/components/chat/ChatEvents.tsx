import { ScrollArea } from "@/components/ui/scroll-area";
import type { StreamedEventNotification } from "@/types";
import { EventItem } from "./EventItem";

interface ChatEventsProps {
  events: StreamedEventNotification["params"][];
}

export function ChatEvents({ events }: ChatEventsProps) {
  const filteredEvents = events.filter(
    (item) =>
      item.msg.type !== "task_started" &&
      item.msg.type !== "agent_reasoning_section_break"
  );

  return (
    <div className="flex-1 min-h-0">
      <ScrollArea className="h-full w-full bg-muted/20 rounded-lg pb-[80px]">
        <div className="space-y-3 p-4">
          {filteredEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Start a conversation to stream Codex events here.
            </p>
          ) : (
            filteredEvents.map((item, index) => {
              // const { msg } = item
              // const key = `${getEventKey(item)}-${index}`;
              return (
                <div
                  key={index}
                  className="rounded-md border bg-background p-3 shadow-sm"
                >
                  <EventItem params={item} />
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
