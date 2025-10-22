import { useCallback, useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { v4 as uuidv4 } from "uuid";

import type { EventMsg } from "@/bindings/EventMsg";
import type { ConversationEventPayload, EventWithId } from "@/types/chat";
import { DELTA_EVENT_TYPES } from "@/types/chat";

function createEventId(raw: unknown): string {
  if (typeof raw === "string" && raw.length > 0) {
    return raw;
  }
  if (typeof raw === "number") {
    return raw.toString();
  }
  return uuidv4();
}

type EventsByConversation = Record<string, EventWithId[]>;

interface UseCodexEventsParams {
  eventsByConversation: EventsByConversation;
  activeConversationId: string | null;
  appendEvent: (conversationId: string, event: EventWithId) => void;
  setIsInitializing: (value: boolean) => void;
  setIsSending: (value: boolean) => void;
  isInitializing: boolean;
}

interface UseCodexEventsResult {
  deltaEventMap: EventsByConversation;
  initializeConversationBuffer: (conversationId: string) => void;
}

export function useCodexEvents({
  eventsByConversation,
  activeConversationId,
  appendEvent,
  setIsInitializing,
  setIsSending,
  isInitializing,
}: UseCodexEventsParams): UseCodexEventsResult {
  const [deltaEventMap, setDeltaEventMap] = useState<EventsByConversation>({});

  useEffect(() => {
    setDeltaEventMap((prev) => {
      let changed = false;
      const next: EventsByConversation = {};

      for (const [key, value] of Object.entries(prev)) {
        if (eventsByConversation[key]) {
          next[key] = value;
        } else {
          changed = true;
          console.debug("[chat] dropping delta buffer for conversation", key);
        }
      }

      if (!changed && Object.keys(next).length === Object.keys(prev).length) {
        return prev;
      }

      return next;
    });
  }, [eventsByConversation]);

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    const setup = async () => {
      try {
        const codexEvents = await listen<ConversationEventPayload>(
          "codex:event",
          (event) => {
            const payload = event.payload;
            if (!payload || !payload.params) return;

            const { conversationId, msg } = payload.params;
            if (!conversationId || !msg) return;

            const eventMsg = msg as EventMsg;
            if (typeof eventMsg !== "object" || typeof eventMsg.type !== "string") {
              return;
            }

            const baseId = createEventId(payload.params.id);
            const eventId = `${conversationId}-${baseId}-${uuidv4()}`;
            const eventRecord: EventWithId = {
              id: eventId,
              msg: eventMsg,
            };

            console.debug("[codex:event]", conversationId, eventMsg.type, eventRecord);

            if (DELTA_EVENT_TYPES.has(eventMsg.type)) {
              setDeltaEventMap((prev) => {
                const current = prev[conversationId] ?? [];
                return {
                  ...prev,
                  [conversationId]: [...current, eventRecord],
                };
              });
              return;
            }

            appendEvent(conversationId, eventRecord);

            if (
              eventMsg.type === "task_complete" ||
              eventMsg.type === "error" ||
              eventMsg.type === "turn_aborted"
            ) {
              setIsSending(false);
            }

            if (isInitializing && conversationId === activeConversationId) {
              setIsInitializing(false);
            }

            setDeltaEventMap((prev) => {
              if (!prev[conversationId] || prev[conversationId].length === 0) {
                return prev;
              }
              console.debug("[chat] flushing delta events", conversationId);
              const { [conversationId]: _removed, ...rest } = prev;
              return rest;
            });
          },
        );

        unlisteners.push(codexEvents);
      } catch (error) {
        console.error("Failed to initialize Codex listeners", error);
      }
    };

    setup();

    return () => {
      unlisteners.forEach((unlisten) => {
        try {
          unlisten();
        } catch (error) {
          console.warn("Failed to remove Codex listener", error);
        }
      });
    };
  }, [
    appendEvent,
    setIsInitializing,
    setIsSending,
    isInitializing,
    activeConversationId,
  ]);

  const initializeConversationBuffer = useCallback((conversationId: string) => {
    setDeltaEventMap((prev) => ({
      ...prev,
      [conversationId]: [],
    }));
  }, []);

  return { deltaEventMap, initializeConversationBuffer };
}

