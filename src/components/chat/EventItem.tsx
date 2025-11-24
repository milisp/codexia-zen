import { Badge } from "../ui/badge";
import type { StreamedEventNotification } from "@/types";

interface EventItemProps {
    params: StreamedEventNotification["params"];
}

export function EventItem({ params }: EventItemProps) {
  const { msg } = params;
  if (msg.type.endsWith("_delta")) return null;
  switch (msg.type) {
    case "agent_message":
      return <p className="text-sm font-medium">{msg.message}</p>;
    case "user_message":
      return <p className="text-sm font-medium justify-end">{msg.message}</p>;
    case "agent_reasoning":
      return <p className="text-sm font-medium">{msg.text}</p>;
    case "task_complete":
      return (
        <p className="text-sm font-medium text-green-600">Task complete</p>
      );
    case "exec_command_begin":
      return (
        <p className="text-sm font-medium break-words">
          Running command: {msg.command.join(" ")}
        </p>
      );
    case "exec_command_end":
      return (
        <p className="text-sm font-medium break-words">
          Command finished ({msg.exit_code}) - {msg.command.join(" ")}
        </p>
      );
    case "patch_apply_begin":
      return (
        <p className="text-sm font-medium">
          Applying patch ({Object.keys(msg.changes ?? {}).length} files)
        </p>
      );
    case "patch_apply_end":
      return (
        <p className="text-sm font-medium">
          Patch {msg.success ? "applied" : "failed"} {msg.stdout || msg.stderr}
        </p>
      );
    case "apply_patch_approval_request":
      return (
        <div>
          <p className="text-sm font-medium">Patch approval requested</p>
          {msg.reason ? (
            <p className="text-xs text-muted-foreground">{msg.reason}</p>
          ) : null}
        </div>
      );
    case "exec_approval_request":
      return (
        <div>
          <p className="text-sm font-medium">
            Command approval requested: {msg.command.join(" ")}
          </p>
          {msg.reason ? (
            <p className="text-xs text-muted-foreground">{msg.reason}</p>
          ) : null}
        </div>
      );
    case "item_started":
    case "item_completed":
    // case "task_started":
    case "token_count":
      return null;
    case "deprecation_notice":
      return (
        <p className="text-xs text-muted-foreground">{JSON.stringify(msg)}</p>
      );
    case "error":
    case "stream_error":
        return <Badge variant="destructive">{msg.message}</Badge>;
    default:
      return <p className="text-xs text-muted-foreground">{msg.type}</p>;
  }
}
