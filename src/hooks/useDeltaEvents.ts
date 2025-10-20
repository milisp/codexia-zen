import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { EventWithId } from "@/types/Message";

/**
 * Hook that captures streaming delta events (agent_message_delta and
 * agent_reasoning_raw_content_delta) for a specific conversation.
 * It does **not** persist data to the conversation store – the events are kept in a
 * local state and cleared when a final agent_message or
 * agent_reasoning_raw_content event arrives.
 */
export function useDeltaEvents(conversationId: string | null) {
  const [eventsMap, setEventsMap] = useState<Record<string, EventWithId[]>>({});

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const start = async () => {
      unlisten = await listen<any>("codex-event", (event) => {
        const params = event.payload.params;
        const { id, msg, conversationId: convId } = params;
        if (!convId || convId !== conversationId) return;

        // Only handle delta events.
        if (
          msg.type !== "agent_message_delta" &&
          msg.type !== "agent_reasoning_raw_content_delta"
        ) {
          // If a final message arrives, clear stored deltas for that id.
          if (
            msg.type === "agent_message" ||
            msg.type === "agent_reasoning_raw_content"
          ) {
            setEventsMap((prev) => {
              const arr = prev[convId] ?? [];
              // Remove any pending deltas with same id.
              const filtered = arr.filter((e) => e.id !== id);
              return { ...prev, [convId]: filtered };
            });
          }
          return;
        }

        setEventsMap((prev) => {
          const cur = prev[convId] ?? [];
          return { ...prev, [convId]: [...cur, { id, msg }] };
        });
      });
    };
    start();
    return () => {
      if (unlisten) unlisten();
    };
    // Re‑setup when conversation changes.
  }, [conversationId]);

  return eventsMap[conversationId ?? ""] ?? [];
}

