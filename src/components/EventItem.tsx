import { ChatEvent } from "@/types/ChatEvent";
import { Badge } from "lucide-react";

export const renderEvent = (event: ChatEvent, index: number) => {
    // Handle user input
    if (event.method === 'user_input') {
      return (
        <div key={index} className="mb-4 p-3 bg-primary/10 rounded-lg">
          <div className="text-sm">{event.params.text}</div>
        </div>
      );
    }

    if (event.method === 'item/agentMessage/delta') {
      return (
        <div key={index} className="text-sm">
          {event.params.delta}
        </div>
      );
    }

    // Handle turn started - don't display, we handle user input separately
    if (event.method === 'turn/started') {
      return null;
    }

    if (event.method === 'error') {
      return <Badge>{event.params.error.message}</Badge>
    }

    if (event.method === 'item/started') {
      return (
        <div key={index} className="text-xs text-muted-foreground italic">
          {event.params.item.type || 'Item started'}
        </div>
      );
    }

    if (event.method === 'item/completed') {
      return null; // Don't show completed items in the UI
    }

    if (event.method === 'turn/completed') {
      return null;
    }

    return null;
  };
