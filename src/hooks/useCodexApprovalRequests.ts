import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { ExecCommandApprovalParams } from "@/bindings/ExecCommandApprovalParams";
import { useApprovalStore } from "@/stores/useApprovalStore";

interface ExecCommandApprovalNotification {
  requestToken: string;
  params: ExecCommandApprovalParams;
}

export function useCodexApprovalRequests() {
  const upsertExecRequest = useApprovalStore((state) => state.upsertExecRequest);

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    const setup = async () => {
      try {
        const execRequestUnlisten = await listen<ExecCommandApprovalNotification>(
          "codex:exec-command-request",
          (event) => {
            const payload = event.payload;
            if (!payload || !payload.params) {
              return;
            }
            const { requestToken, params } = payload;
            if (!requestToken) {
              return;
            }

            upsertExecRequest({
              requestToken,
              conversationId: params.conversationId,
              callId: params.callId,
              command: params.command,
              cwd: params.cwd,
              reason: params.reason ?? null,
              createdAt: Date.now(),
            });
          },
        );
        unlisteners.push(execRequestUnlisten);
      } catch (error) {
        console.error("Failed to initialize approval listeners", error);
      }
    };

    setup();

    return () => {
      unlisteners.forEach((unlisten) => {
        try {
          unlisten();
        } catch (error) {
          console.warn("Failed to remove approval listener", error);
        }
      });
    };
  }, [upsertExecRequest]);
}
