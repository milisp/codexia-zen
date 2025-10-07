import { useCallback, useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { FilePlus } from "lucide-react";

import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatMessageList } from "@/components/chat/ChatMessage";
import type { ChatMessage, CodexEvent } from "@/components/chat/types";
import { parseUnifiedDiff } from "@/components/diff/DiffView";
import { Button } from "@/components/ui/button";

interface SendResponse {
  submission_id: string;
  timestamp: string;
}
const DEFAULT_CONFIG_OVERRIDES = [
  "cwd=/Users/gpt/pylang/demo",
  "model_provider=oss",
  "chatgpt_base_url=http://localhost:11434/v1",
  "model=llama3.2",
  "show_raw_agent_reasoning=true",
  "approval_policy=on-request",
  "sandbox_mode=workspace-write",
];

function makeUserId(id: string) {
  return `user-${id}`;
}

function makeAssistantId(id: string) {
  return `assistant-${id}`;
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function createDiffId(seed: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${seed}-${crypto.randomUUID()}`;
  }
  return `${seed}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => []);
  const [draft, setDraft] = useState("");
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const sessionStateRef = useRef<"idle" | "starting" | "ready">("idle");
  const startSessionPromiseRef = useRef<Promise<void> | null>(null);

  const pushSystemMessage = useCallback(
    (content: string, timestamp?: string) => {
      const entry: ChatMessage = {
        id: createDiffId("system"),
        role: "system",
        content,
        timestamp: timestamp ?? new Date().toISOString(),
      };
      setMessages((prev) => [...prev, entry]);
    },
    [],
  );

  const startSession = useCallback(() => {
    return invoke<void>("chatbox_start_session", {
      payload: { config_overrides: DEFAULT_CONFIG_OVERRIDES },
    });
  }, []);

  const ensureSessionStarted = useCallback(async () => {
    if (sessionStateRef.current === "ready") return;
    if (
      sessionStateRef.current === "starting" &&
      startSessionPromiseRef.current !== null
    ) {
      await startSessionPromiseRef.current;
      return;
    }

    sessionStateRef.current = "starting";
    const promise = startSession()
      .then(() => {
        sessionStateRef.current = "ready";
      })
      .catch((error) => {
        sessionStateRef.current = "idle";
        throw error;
      })
      .finally(() => {
        startSessionPromiseRef.current = null;
      });

    startSessionPromiseRef.current = promise;
    await promise;
  }, [startSession]);

  const handleBackendEvent = useCallback(
    (event: CodexEvent) => {
      if (!event.kind.includes(['agent_message_delta'])) {
        console.log("event.kind", event.kind, event);
      }
      switch (event.kind) {
        case "session_configured": {
          sessionStateRef.current = "ready";
          break;
        }
        case "user_message": {
          if (!event.id) break;
          const userId = makeUserId(event.id);
          setMessages((prev) => {
            const index = prev.findIndex((message) => message.id === userId);
            const entry: ChatMessage = {
              id: userId,
              role: "user",
              content: event.message,
              timestamp: event.timestamp,
            };
            if (index === -1) return [...prev, entry];
            const next = [...prev];
            next[index] = {
              ...next[index],
              content: event.message,
              timestamp: event.timestamp,
            };
            return next;
          });
          break;
        }
        case "agent_message_delta": {
          if (!event.id) break;
          const assistantId = makeAssistantId(event.id);
          setMessages((prev) => {
            const index = prev.findIndex(
              (message) => message.id === assistantId,
            );
            if (index === -1) {
              return [
                ...prev,
                {
                  id: assistantId,
                  role: "assistant",
                  content: event.delta,
                  timestamp: event.timestamp,
                  isStreaming: true,
                },
              ];
            }
            const next = [...prev];
            const current = next[index];
            next[index] = {
              ...current,
              content: `${current.content}${event.delta}`,
              timestamp: event.timestamp,
              isStreaming: true,
            };
            return next;
          });
          break;
        }
        case "agent_message": {
          if (!event.id) break;
          const assistantId = makeAssistantId(event.id);
          setMessages((prev) => {
            const index = prev.findIndex(
              (message) => message.id === assistantId,
            );
            if (index === -1) {
              return [
                ...prev,
                {
                  id: assistantId,
                  role: "assistant",
                  content: event.message,
                  timestamp: event.timestamp,
                  isStreaming: false,
                },
              ];
            }
            const next = [...prev];
            next[index] = {
              ...next[index],
              content: event.message,
              timestamp: event.timestamp,
              isStreaming: false,
            };
            return next;
          });
          break;
        }
        case "task_started": {
          if (!event.id) break;
          setBusyIds((prev) =>
            prev.includes(event.id) ? prev : [...prev, event.id],
          );
          break;
        }
        case "task_complete": {
          if (!event.id) break;
          setBusyIds((prev) => prev.filter((value) => value !== event.id));
          if (event.last_agent_message) {
            const assistantId = makeAssistantId(event.id);
            setMessages((prev) => {
              const index = prev.findIndex(
                (message) => message.id === assistantId,
              );
              if (index === -1) {
                return [
                  ...prev,
                  {
                    id: assistantId,
                    role: "assistant",
                    content: event.last_agent_message ?? "",
                    timestamp: event.timestamp,
                    isStreaming: false,
                  },
                ];
              }
              const next = [...prev];
              next[index] = {
                ...next[index],
                content: event.last_agent_message ?? next[index].content,
                timestamp: event.timestamp,
                isStreaming: false,
              };
              return next;
            });
          } else {
            const assistantId = makeAssistantId(event.id);
            setMessages((prev) => {
              const index = prev.findIndex(
                (message) => message.id === assistantId,
              );
              if (index === -1) return prev;
              const next = [...prev];
              next[index] = {
                ...next[index],
                isStreaming: false,
                timestamp: event.timestamp,
              };
              return next;
            });
          }
          break;
        }
        case "turn_diff": {
          console.log(event)
          if (!event.id) break;
          const assistantId = makeAssistantId(event.id);
          const diffs = parseUnifiedDiff(event.unified_diff);
          setMessages((prev) => {
            const index = prev.findIndex(
              (message) => message.id === assistantId,
            );
            if (index === -1) {
              return [
                ...prev,
                {
                  id: assistantId,
                  role: "assistant",
                  content: "",
                  timestamp: event.timestamp,
                  diffs,
                  isStreaming: true,
                },
              ];
            }
            const next = [...prev];
            next[index] = {
              ...next[index],
              diffs,
              timestamp: event.timestamp,
            };
            return next;
          });
          break;
        }
        case "error": {
          if (event.id) {
            setBusyIds((prev) => prev.filter((value) => value !== event.id));
          }
          pushSystemMessage(`Error: ${event.message}`, event.timestamp);
          break;
        }
        case "process_exited": {
          setBusyIds([]);
          sessionStateRef.current = "idle";
          startSessionPromiseRef.current = null;
          const parts = ["Codex session exited"];
          if (typeof event.code === "number") parts.push(`code ${event.code}`);
          if (typeof event.signal === "number")
            parts.push(`signal ${event.signal}`);
          pushSystemMessage(parts.join(" – "), event.timestamp);
          break;
        }
        case "log": {
          if (event.level === "stderr" || event.level === "error") {
            pushSystemMessage(
              `${event.level.toUpperCase()}: ${event.message}`,
              event.timestamp,
            );
          }
          break;
        }
        default:
          break;
      }
    },
    [pushSystemMessage],
  );

  useEffect(() => {
    const unlistenPromise = listen<CodexEvent>("codex-event", (event) => {
      handleBackendEvent(event.payload);
    });

    return () => {
      unlistenPromise
        .then((unlisten: UnlistenFn) => unlisten())
        .catch(() => undefined);
    };
  }, [handleBackendEvent]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const isThinking = busyIds.length > 0;

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;

    try {
      await ensureSessionStarted();
    } catch (error: unknown) {
      pushSystemMessage(`Failed to start Codex: ${formatError(error)}`);
      return;
    }

    try {
      const response = await invoke<SendResponse>("chatbox_send", {
        payload: { prompt: text },
      });
      const submissionId = response.submission_id;
      const timestamp = response.timestamp;
      const userMessage: ChatMessage = {
        id: makeUserId(submissionId),
        role: "user",
        content: text,
        timestamp,
      };
      setMessages((prev) => [...prev, userMessage]);
      setDraft("");
      setBusyIds((prev) =>
        prev.includes(submissionId) ? prev : [...prev, submissionId],
      );
    } catch (error: unknown) {
      pushSystemMessage(`Failed to send prompt: ${formatError(error)}`);
    }
  }, [draft, ensureSessionStarted, pushSystemMessage]);

  const handleNewSession = useCallback(() => {
    setMessages([]);
    setBusyIds([]);
    sessionStateRef.current = "idle";
    startSessionPromiseRef.current = null;
  }, [pushSystemMessage]);

  return (
    <main className="relative flex grow flex-col overflow-hidden">
      <div className="absolute left-4 top-4 z-10">
        <Button variant="outline" size="icon" onClick={handleNewSession}>
          <FilePlus className="h-4 w-4" />
        </Button>
      </div>
      <div ref={viewportRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-4 py-6">
          <ChatMessageList messages={messages} />
        </div>
      </div>
      <div className="shrink-0 border-t bg-background">
        <div className="mx-auto w-full max-w-5xl px-4 py-4">
          <ChatComposer
            value={draft}
            onChange={setDraft}
            onSubmit={handleSend}
            disabled={isThinking}
          />
          {isThinking && (
            <div className="pt-2 text-center text-xs text-muted-foreground">
              Assistant is preparing a response…
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
