import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useChatStore } from "@/stores/useChatStore";
import { Line } from "@/types";

export function useChatListeners() {
  const { updateLastAgentMessage } = useChatStore();

  useEffect(() => {
    let unlistenEvents: (() => void) | undefined;
    let isSetup = false;

    const setupListeners = async () => {
      if (isSetup) return;
      isSetup = true;

      unlistenEvents = await listen<Line>(
        "codex-event",
        (event) => {
          const params = event.payload.params
          const { id, msg, conversationId } = params;
          const convId = conversationId

          if (msg.type !== 'agent_message_delta' && msg.type !== 'agent_reasoning_raw_content_delta') {
            console.log(`Received codex-event: ${convId} params.id ${id}`, msg);
          }
          if (!convId) return;
          updateLastAgentMessage(convId, { id, msg: msg });
        },
      );
    };

    setupListeners();

    return () => {
      if (unlistenEvents) unlistenEvents();
    };
  }, []);
}
