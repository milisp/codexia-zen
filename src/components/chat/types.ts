export type TurnDiff = {
  id: string;
  filename: string;
  added: number;
  removed: number;
  diff: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  diffs?: TurnDiff[];
  isStreaming?: boolean;
};

export type CodexEvent =
  | { kind: "session_configured"; timestamp: string }
  | { kind: "user_message"; id: string; message: string; timestamp: string }
  | {
      kind: "agent_message_delta";
      id: string;
      delta: string;
      timestamp: string;
    }
  | { kind: "agent_message"; id: string; message: string; timestamp: string }
  | { kind: "task_started"; id: string; timestamp: string }
  | {
      kind: "task_complete";
      id: string;
      timestamp: string;
      last_agent_message?: string | null;
    }
  | { kind: "turn_diff"; id: string; unified_diff: string; timestamp: string }
  | { kind: "error"; id?: string; message: string; timestamp: string }
  | {
      kind: "process_exited";
      timestamp: string;
      code?: number | null;
      signal?: number | null;
    }
  | { kind: "log"; level: string; message: string; timestamp: string }
  | { kind: "update_plan"; msg: string };
