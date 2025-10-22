import { memo, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useApprovalStore } from "@/stores/useApprovalStore";
import type { ConversationEvent } from "@/types/chat";

type EventVariant = "user" | "assistant" | "system";

const VARIANT_CLASSES: Record<EventVariant, string> = {
  user: "bg-primary text-primary-foreground",
  assistant: "bg-muted text-foreground",
  system: "bg-background text-foreground border border-border",
};

const TITLE_CLASSES: Record<EventVariant, string> = {
  user: "text-primary-foreground/80",
  assistant: "text-muted-foreground",
  system: "text-muted-foreground",
};

function EventBubble({
  align,
  variant,
  title,
  children,
}: {
  align: "start" | "end";
  variant: EventVariant;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex w-full",
        align === "end" ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-xl rounded-lg px-4 py-3 text-sm shadow-sm",
          VARIANT_CLASSES[variant],
        )}
      >
        {title ? (
          <div
            className={cn(
              "mb-2 text-xs font-semibold uppercase tracking-wide",
              TITLE_CLASSES[variant],
            )}
          >
            {title}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

function describeParsedCommand(
  parsed: { type: string; cmd: string; name?: string | null; path?: string | null; query?: string | null },
): string {
  switch (parsed.type) {
    case "read":
      return parsed.name ? `read ${parsed.name}` : parsed.cmd;
    case "list_files":
      return parsed.path ? `list ${parsed.path}` : parsed.cmd;
    case "search":
      return parsed.query ? `search "${parsed.query}"` : parsed.cmd;
    default:
      return parsed.cmd;
  }
}

function describeFileChange(change: unknown): { label: string; detail?: string } {
  if (typeof change !== "object" || change === null) {
    return { label: "Change" };
  }

  if ("add" in change) {
    const add = (change as { add?: unknown }).add;
    if (add) {
      return { label: "Add" };
    }
  }

  if ("delete" in change) {
    const del = (change as { delete?: unknown }).delete;
    if (del) {
      return { label: "Delete" };
    }
  }

  if ("update" in change) {
    const update = (change as { update?: { move_path?: unknown } }).update;
    const movePath =
      update && typeof update.move_path === "string" ? update.move_path : null;
    return {
      label: "Update",
      detail: movePath ? `moved to ${movePath}` : undefined,
    };
  }

  return { label: "Change" };
}

function OutputBlock({ label, value }: { label: string; value: string }) {
  if (!value || !value.trim()) {
    return null;
  }
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-2 font-mono text-xs">
        {value}
      </pre>
    </div>
  );
}

function formatAbortReason(reason: string): string {
  switch (reason) {
    case "interrupted":
      return "The turn was interrupted by the user.";
    case "replaced":
      return "A newer turn replaced the current one.";
    case "review_ended":
      return "Review mode ended the current turn.";
    default:
      return "The turn ended early.";
  }
}

function DefaultEventContent({
  message,
  type,
}: {
  message?: string | null;
  type: string;
}) {
  if (message) {
    return (
      <p className="whitespace-pre-wrap leading-relaxed">
        {message}
      </p>
    );
  }

  return (
    <p className="text-xs text-muted-foreground">
      Received an event of type {type}.
    </p>
  );
}

type ExecDecision = "approved" | "approved_for_session" | "denied" | "abort";

export const EventItem = memo(function EventItem({
  event,
  conversationId,
}: {
  event: ConversationEvent;
  conversationId: string | null;
}) {
  const { msg } = event;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const execApprovalRequest = useApprovalStore((state) => {
    if (msg.type !== "exec_approval_request") {
      return null;
    }
    const entry = state.execRequests[msg.call_id] ?? null;
    if (!entry) {
      return null;
    }
    if (conversationId && entry.conversationId !== conversationId) {
      return null;
    }
    return entry;
  });
  const removeExecRequest = useApprovalStore((state) => state.removeExecRequest);

  const handleExecDecision = async (decision: ExecDecision) => {
    if (!execApprovalRequest || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await invoke("respond_exec_command_request", {
        request_token: execApprovalRequest.requestToken,
        decision,
      });
      removeExecRequest(execApprovalRequest.callId);
      const decisionLabel: Record<ExecDecision, string> = {
        approved: "approved",
        approved_for_session: "approved for this session",
        denied: "denied",
        abort: "aborted",
      };
      toast({
        title: "Decision submitted",
        description: `You ${decisionLabel[decision]} the command.`,
      });
    } catch (error) {
      console.error("Failed to send exec approval decision", error);
      const description =
        error instanceof Error ? error.message : String(error);
      toast({
        title: "Failed to send approval",
        description,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  switch (msg.type) {
    case "user_message":
      return (
        <EventBubble align="end" variant="user">
          <p className="whitespace-pre-wrap leading-relaxed">
            {msg.message}
          </p>
        </EventBubble>
      );
    case "agent_message":
      return (
        <EventBubble align="start" variant="assistant">
          <p className="whitespace-pre-wrap leading-relaxed">
            {msg.message}
          </p>
        </EventBubble>
      );
    case "agent_reasoning":
      return (
        <EventBubble
          align="start"
          variant="assistant"
          title="Reasoning"
        >
          <p className="whitespace-pre-wrap text-xs text-muted-foreground">
            {msg.text}
          </p>
        </EventBubble>
      );
    case "exec_approval_request": {
      const commandText = msg.command.join(" ");
      const awaitingDecision = Boolean(execApprovalRequest);
      return (
        <EventBubble
          align="start"
          variant="system"
          title="Command Approval Requested"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant={awaitingDecision ? "destructive" : "secondary"}>
                {awaitingDecision ? "Awaiting decision" : "Decision submitted"}
              </Badge>
              <Badge variant="outline">{msg.call_id}</Badge>
            </div>
            {msg.reason && (
              <p className="text-sm leading-relaxed">
                {msg.reason}
              </p>
            )}
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Command
              </div>
              <code className="block whitespace-pre-wrap rounded bg-muted/50 px-2 py-1 font-mono text-xs">
                {commandText}
              </code>
            </div>
            {msg.cwd && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">cwd:</span> 
                <code className="font-mono">{msg.cwd}</code>
              </div>
            )}
            {awaitingDecision ? (
              <div className="space-y-3 border-t border-border/50 pt-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => handleExecDecision("approved")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isSubmitting}
                    onClick={() => handleExecDecision("approved_for_session")}
                  >
                    Approve for session
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => handleExecDecision("denied")}
                  >
                    Deny
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isSubmitting}
                    onClick={() => handleExecDecision("abort")}
                  >
                    Abort turn
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Approving will run the command in the specified directory. Denying or aborting lets Codex continue without running it.
                </p>
                {isSubmitting ? (
                  <div className="text-xs text-muted-foreground">
                    Sending decision…
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="border-t border-border/50 pt-3 text-xs text-muted-foreground">
                Waiting for Codex to continue with the recorded decision.
              </div>
            )}
          </div>
        </EventBubble>
      );
    }
    case "exec_command_begin":
      return (
        <EventBubble
          align="start"
          variant="system"
          title="Command Started"
        >
          <div className="space-y-2">
            <code className="block whitespace-pre-wrap rounded bg-muted/40 px-2 py-1 font-mono text-xs">
              {msg.command.join(" ")}
            </code>
            {msg.cwd && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">cwd:</span> 
                <code className="font-mono">{msg.cwd}</code>
              </div>
            )}
            {msg.parsed_cmd.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {msg.parsed_cmd.map((item, index) => (
                  <Badge
                    key={`${item.type}-${index}`}
                    variant="secondary"
                  >
                    {describeParsedCommand(item)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </EventBubble>
      );
    case "exec_command_end":
      return null
    case "patch_apply_begin": {
      const entries = Object.entries(msg.changes ?? {});
      return (
        <EventBubble
          align="start"
          variant="system"
          title="Applying Patch"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant={msg.auto_approved ? "secondary" : "outline"}>
                {msg.auto_approved ? "Auto-approved" : "Pending approval"}
              </Badge>
            </div>
            <div className="space-y-2">
              {entries.length > 0 ? (
                entries.map(([path, change]) => {
                  if (!change) return null;
                  const { label, detail } = describeFileChange(change);
                  return (
                    <div key={path} className="space-y-1 rounded border border-border/60 bg-muted/30 p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{label}</Badge>
                        <span className="font-mono text-xs">{path}</span>
                      </div>
                      {detail && (
                        <div className="text-xs text-muted-foreground">
                          {detail}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-muted-foreground">
                  No file changes were included in this patch.
                </div>
              )}
            </div>
          </div>
        </EventBubble>
      );
    }
    case "patch_apply_end":
      return (
        <EventBubble
          align="start"
          variant="system"
          title="Patch Result"
        >
          <div className="space-y-3">
            <Badge variant={msg.success ? "secondary" : "destructive"}>
              {msg.success ? "Succeeded" : "Failed"}
            </Badge>
            <OutputBlock label="stdout" value={msg.stdout} />
            <OutputBlock label="stderr" value={msg.stderr} />
          </div>
        </EventBubble>
      );
    case "turn_aborted":
      return (
        <EventBubble align="start" variant="system" title="Turn Aborted">
          <div className="space-y-2">
            <Badge variant="destructive">{msg.reason}</Badge>
            <p className="text-sm text-muted-foreground">
              {formatAbortReason(msg.reason)}
            </p>
          </div>
        </EventBubble>
      );
    case "turn_diff":
      return (
        <EventBubble align="start" variant="system" title="Turn Diff">
          <pre className="max-h-64 overflow-auto whitespace-pre text-xs font-mono leading-relaxed">
            {msg.unified_diff}
          </pre>
        </EventBubble>
      );
    
    case "task_complete":
    case "task_started":
    case "exec_command_output_delta":
    case "token_count":
    case "plan_update":
      return null;
    default:
      return (
        <EventBubble
          align="start"
          variant="system"
          title={msg.type}
        >
          <DefaultEventContent
            message={
              "message" in msg && typeof msg.message === "string"
                ? msg.message
                : undefined
            }
            type={msg.type}
          />
        </EventBubble>
      );
  }
})
