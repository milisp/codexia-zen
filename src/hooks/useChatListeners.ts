import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useChatStore } from "@/stores/useChatStore";
import { useSessionStore } from "@/stores/useSessionStore";
import { useConversationStore } from "@/stores/useConversationStore";
import { EventMsg } from "@/bindings/EventMsg";

export function useChatListeners(setIsSending: (value: boolean) => void) {
  const { updateLastAgentMessage } = useChatStore();
  const { setIsInitializing, setError } = useSessionStore();

  useEffect(() => {
    let unlistenEvents: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;
    let isSetup = false;

    const setupListeners = async () => {
      if (isSetup) return;
      isSetup = true;

      unlistenEvents = await listen<[string, string, EventMsg]>(
        "codex-event",
        (event) => {
          const [, eventId, eventMsg] = event.payload;
          const convId = useConversationStore.getState().activeConversationId;
          
          if (!eventMsg || typeof eventMsg.type === "undefined") {
            console.error("Received malformed codex-event payload:", eventMsg);
            return;
          }

          if (eventMsg.type !== 'agent_message_delta' && eventMsg.type !== 'agent_reasoning_raw_content_delta') {
            console.log(`Received codex-event: ${convId}`, eventMsg);
          }
          if (!convId) return;
          updateLastAgentMessage(convId, { id: eventId, msg: eventMsg });
        },
      );

      unlistenError = await listen<string>(
        "session_init_failed",
        ({ payload }) => {
          setError(`App Server Error: ${payload}`);
          setIsInitializing(false);
          setIsSending(false);
        },
      );
    };

    setupListeners();

    return () => {
      if (unlistenEvents) unlistenEvents();
      if (unlistenError) unlistenError();
    };
  }, []);
}
