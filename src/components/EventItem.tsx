import { ChatEvent } from "@/types/ChatEvent";
import { Badge } from "./ui/badge";

export const renderEvent = (event: ChatEvent, index: number) => {
  switch (event.method) {
    case "user_input":
      return (
        <div key={index} className="mb-4 p-3 bg-primary/10 rounded-lg">
          <div className="text-sm">{event.params.text}</div>
        </div>
      );

    case "item/agentMessage/delta":
      return (
        <div key={index} className="text-sm">
          {event.params.delta}
        </div>
      );
    case "error":
      return <Badge>{event.params.error.message}</Badge>;

    case "item/started":
      const { item } = event.params;
      switch (item.type) {
        case "reasoning":
          return (
            <div key={index} className="text-xs text-muted-foreground italic">
              {item.summary.map((s, i) => (
                <div key={i}>{s}</div>
              ))}
            </div>
          );
        default:
          return <Badge>{item.type}</Badge>
      }
    case "item/completed":
    case "turn/started":
    case "turn/completed":
      return null;

    default:
      return (
        <pre>
          <code>{JSON.stringify(event.params, null, 2)}</code>
        </pre>);
  }
};
