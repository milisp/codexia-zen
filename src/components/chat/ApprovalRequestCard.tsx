import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import type { ExecCommandApprovalParams } from "@/bindings/ExecCommandApprovalParams";
import type { FileChange } from "@/bindings/FileChange";

type ApplyPatchApprovalPayload = {
  conversationId: string;
  callId: string;
  fileChanges: Record<string, FileChange | undefined>;
  reason: string | null;
  grantRoot: string | null;
};

export type ApprovalRequestNotification =
  | {
      request_id: string;
      type: "exec_command";
      params: ExecCommandApprovalParams;
    }
  | {
      request_id: string;
      type: "apply_patch";
      params: ApplyPatchApprovalPayload;
    };

type ReviewDecisionType =
  | "approved"
  | "approved_for_session"
  | "denied"
  | "abort";

const APPROVAL_DECISIONS: Array<{
  label: string;
  value: ReviewDecisionType;
}> = [
  { label: "Allow once", value: "approved" },
  { label: "Allow for session", value: "approved_for_session" },
  { label: "Deny", value: "denied" },
  { label: "Abort", value: "abort" },
];

interface ApprovalRequestCardProps {
  request: ApprovalRequestNotification;
  processing: boolean;
  onDecision: (
    requestId: string,
    requestType: ApprovalRequestNotification["type"],
    decision: ReviewDecisionType,
  ) => void;
}

export function ApprovalRequestCard({
  processing,
  request,
  onDecision,
}: ApprovalRequestCardProps) {
  const fileCount =
    request.type === "apply_patch"
      ? Object.keys(request.params.fileChanges ?? {}).length
      : 0;
  const commandLabel =
    request.type === "exec_command"
      ? request.params.command.join(" ")
      : `${fileCount} file${fileCount === 1 ? "" : "s"}`;

  return (
    <div className="rounded-lg border bg-background p-4 shadow-sm shadow-muted/20">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>
          {request.type === "exec_command"
            ? "Command execution approval"
            : "Patch apply approval"}
        </span>
        <span className="text-[10px]">{request.params.callId}</span>
      </div>
      <p className="mt-1 text-sm font-medium wrap-break-words">
        {commandLabel || "No details provided"}
      </p>
      {request.params.reason ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Reason: {request.params.reason}
        </p>
      ) : null}
      {request.type === "exec_command" && request.params.risk?.description ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Risk: {request.params.risk.description}
        </p>
      ) : null}
      {request.type === "apply_patch" && request.params.grantRoot ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Grant root: {request.params.grantRoot}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {APPROVAL_DECISIONS.map((decision) => (
          <Button
            key={decision.value}
            size="sm"
            variant={
              decision.value === "denied" || decision.value === "abort"
                ? "destructive"
                : "outline"
            }
            onClick={() =>
              onDecision(request.request_id, request.type, decision.value)
            }
            disabled={processing}
          >
            {decision.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function ApprovalRequestPanel() {
  const [approvalRequests, setApprovalRequests] = useState<
    ApprovalRequestNotification[]
  >([]);
  const [processingApprovalIds, setProcessingApprovalIds] = useState<string[]>(
    [],
  );

  const handleDecision = useCallback(
    async (
      requestId: string,
      requestType: ApprovalRequestNotification["type"],
      decision: ReviewDecisionType,
    ) => {
      setProcessingApprovalIds((prev) => [...prev, requestId]);

      const command =
        requestType === "exec_command"
          ? "respond_exec_command_approval"
          : "respond_apply_patch_approval";

      try {
        await invoke(command, { requestId, decision });
        setApprovalRequests((prev) =>
          prev.filter((request) => request.request_id !== requestId),
        );
      } catch (error) {
        console.error("failed to respond to approval request", error);
      } finally {
        setProcessingApprovalIds((prev) =>
          prev.filter((id) => id !== requestId),
        );
      }
    },
    [],
  );

  useEffect(() => {
    const unlisten = listen<ApprovalRequestNotification>(
      "codex://approval-request",
      (event) => {
        setApprovalRequests((prev) => [...prev, event.payload]);
      },
    );

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  if (!approvalRequests.length) {
    return null;
  }

  return (
    <div className="space-y-3 px-4">
      {approvalRequests.map((request) => (
        <ApprovalRequestCard
          key={request.request_id}
          request={request}
          onDecision={handleDecision}
          processing={processingApprovalIds.includes(request.request_id)}
        />
      ))}
    </div>
  );
}
