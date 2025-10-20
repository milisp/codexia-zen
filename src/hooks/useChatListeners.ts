import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useConversationStore } from "@/stores/useConversationStore";
import { useTaskStore } from "@/stores/useTaskStore";
import { Line } from "@/types";

export function useChatListeners() {
  const { updateLastAgentMessage } = useConversationStore();
  const { setTaskStartTime, setTaskEndTime } = useTaskStore();

  useEffect(() => {
    let unlistenEvents: (() => void) | undefined;
    let isSetup = false;

    const setupListeners = async () => {
      if (isSetup) return;
      isSetup = true;

      unlistenEvents = await listen<Line>(
        "codex-event",
        (event) => {
          const params = event.payload.params;
          const { id, msg, conversationId } = params;
          const convId = conversationId;

          if (msg.type === "task_started") {
            setTaskStartTime(Date.now());
          } else if (msg.type === "task_complete") {
            setTaskEndTime(Date.now());
          }

          // Skip storing streaming delta events; they are rendered directly in EventLog.
          if (
            msg.type === "agent_message_delta" ||
            msg.type === "agent_reasoning_raw_content_delta"
          ) {
            // Do not persist deltas to the conversation store.
            return;
          }

          if (!convId) return;
          // Log non‑delta events for debugging.
          console.log(`Received codex-event: ${convId} params.id ${id}`, msg);
          updateLastAgentMessage(convId, { id, msg: msg });
        },
      );
    };

    setupListeners();

    return () => {
      if (unlistenEvents) unlistenEvents();
    };
  }, [setTaskStartTime, setTaskEndTime, updateLastAgentMessage]);
}
