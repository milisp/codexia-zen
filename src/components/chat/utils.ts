import type { Thread } from "@/bindings/v2/Thread";
import type { ThreadItem } from "@/bindings/v2/ThreadItem";
import type { EventMsg } from "@/bindings/EventMsg";
import type { StreamedEventNotification } from "@/types";

export function threadToEvents(
  thread: Thread,
): StreamedEventNotification["params"][] {
  const events: StreamedEventNotification["params"][] = [];

  for (const turn of thread.turns) {
    for (const item of turn.items) {
      const msg = convertThreadItemToEventMsg(item);
      if (!msg) {
        continue;
      }

      events.push({
        conversationId: thread.id,
        id: item.id,
        msg,
      });
    }
  }

  return events;
}

export function convertThreadItemToEventMsg(
  item: ThreadItem,
): EventMsg | null {
  switch (item.type) {
    case "agentMessage":
      return { type: "agent_message", message: item.text };
    case "userMessage": {
      const parts: string[] = [];
      const images: string[] = [];

      for (const input of item.content) {
        switch (input.type) {
          case "text":
            parts.push(input.text);
            break;
          case "image":
            parts.push(`Image: ${input.url}`);
            images.push(input.url);
            break;
          case "localImage":
            parts.push(`Image: ${input.path}`);
            images.push(input.path);
            break;
        }
      }

      return {
        type: "user_message",
        message: parts.length > 0 ? parts.join("\n") : "User message",
        images: images.length > 0 ? images : null,
      };
    }
    default:
      return null;
  }
}
