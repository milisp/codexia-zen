import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useCodexStore } from '@/stores/useCodexStore';
import { useApprovalStore } from '@/stores/useApprovalStore';
import type { ServerNotification } from '@/bindings/ServerNotification';

export function useCodexEvents() {
  const {addEvent} = useCodexStore();
  const {addApproval} = useApprovalStore();

  useEffect(() => {
    // Listen for all codex:// events
    const unlistenPromises: Promise<() => void>[] = [];

    // Listen for approval requests
    unlistenPromises.push(
      listen('codex://approval-request', (event) => {
        const approval = event.payload as any;
        addApproval({
          requestId: approval.requestId,
          threadId: approval.threadId,
          turnId: approval.turnId,
          itemId: approval.itemId,
          reason: approval.reason,
          type: approval.kind?.type === 'commandExecution' ? 'commandExecution' : 'fileChange',
          proposedExecpolicyAmendment:
            approval.kind?.type === 'commandExecution'
              ? approval.kind.proposedExecpolicyAmendment
              : undefined,
          grantRoot:
            approval.kind?.type === 'fileChange' ? approval.kind.grantRoot : undefined,
        });
      })
    );

    // Add a catch-all listener to see ALL codex events
    console.log('[useCodexEvents] Setting up event listeners...');

    unlistenPromises.push(
      listen<ServerNotification>("codex:notification", (event) => {
        console.log('[useCodexEvents] Received notification:', event.payload);

        // Extract threadId from notification params
        const notification = event.payload;
        let threadId: string | undefined;

        if ('params' in notification && notification.params) {
          const params = notification.params as any;
          // Most notifications have threadId directly
          if ('threadId' in params) {
            threadId = params.threadId;
          }
          // ThreadStartedNotification has thread.id
          else if ('thread' in params && params.thread?.id) {
            threadId = params.thread.id;
          }
        }

        if (threadId) {
          addEvent(threadId, notification);
        } else {
          console.warn('[useCodexEvents] No threadId found in notification:', notification);
        }
      })
    );

    // Cleanup
    return () => {
      Promise.all(unlistenPromises).then((unlisteners) => {
        unlisteners.forEach((unlisten) => unlisten());
      });
    };
  }, [addEvent, addApproval]);
}
