import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { PencilIcon } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState, useCallback } from "react";
import { useCodexStore } from "@/stores/useCodexStore";
import { useActiveConversationStore } from "@/stores/useActiveConversationStore";
import { useEventStore } from "@/stores/useEventStore";
import type { Thread } from "@/bindings/v2/Thread";
import type { ThreadListParams } from "@/bindings/v2/ThreadListParams";
import type { ThreadListResponse } from "@/bindings/v2/ThreadListResponse";
import type { ThreadResumeParams } from "@/bindings/v2/ThreadResumeParams";
import type { ThreadResumeResponse } from "@/bindings/v2/ThreadResumeResponse";
import type { NewConversationResponse } from "@/bindings/NewConversationResponse";
import { StreamedEventNotification } from "@/types";
import {
  ThreadSidebar,
  ChatEvents,
  ChatInput,
  threadToEvents,
} from "@/components/chat";
import type { NewConversationParams } from "@/bindings/NewConversationParams";
import { getNewConversationParams } from "@/components/codexConfig/ConversationParams";
import { useSandboxStore } from "@/stores/useSandboxStore";
import type { ExecCommandApprovalParams } from "@/bindings/ExecCommandApprovalParams";
import type { FileChange } from "@/bindings/FileChange";

type ReviewDecisionType = "approved" | "approved_for_session" | "denied" | "abort";

type ApplyPatchApprovalPayload = {
  conversationId: string;
  callId: string;
  fileChanges: Record<string, FileChange | undefined>;
  reason: string | null;
  grantRoot: string | null;
};

type ApprovalRequestNotification =
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

const APPROVAL_DECISIONS: Array<{
  label: string;
  value: ReviewDecisionType;
}> = [
  { label: "Allow once", value: "approved" },
  { label: "Allow for session", value: "approved_for_session" },
  { label: "Deny", value: "denied" },
  { label: "Abort", value: "abort" },
];

export default function ChatPage() {
  const { cwd } = useCodexStore();
  const { mode, approvalPolicy } = useSandboxStore();
  const {
    selectedModel,
    reasoningEffort,
    selectedProvider: selectedProviderName,
  } = useCodexStore();
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadCursor, setThreadCursor] = useState<string | null>(null);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [resumeStatus, setResumeStatus] = useState<string | null>(null);
  const [approvalRequests, setApprovalRequests] = useState<
    ApprovalRequestNotification[]
  >([]);
  const [processingApprovalIds, setProcessingApprovalIds] = useState<string[]>(
    [],
  );

  const {
    activeConversationId,
    activeConversationIds,
    setActiveConversationId,
  } = useActiveConversationStore();

  const {
    eventsByConversationId,
    appendEvent,
    setConversationEvents,
  } = useEventStore();
  const events = activeConversationId
    ? eventsByConversationId[activeConversationId] ?? []
    : [];

  const addEvent = useCallback(
    (notification: StreamedEventNotification) => {
      const { params } = notification;
      if (!params.conversationId || !params.id || !params.msg) {
        return;
      }
      const { msg } = params;
      if (
        msg.type.startsWith("item_") ||
        msg.type === "token_count" ||
        msg.type.endsWith("_delta") ||
        msg.type === "agent_message_delta" ||
        msg.type === "exec_command_output_delta"
      ) {
        return;
      } else {
        if (!msg.type.endsWith("_delta")) {
          console.info(msg) // don't remove this
        }
      }
      appendEvent(params);
      setActiveConversationId(params.conversationId);
    },
    [appendEvent, setActiveConversationId],
  );

  const loadThreads = useCallback(async (cursor: string | null = null) => {
    setIsThreadLoading(true);
    try {
      const params: ThreadListParams = {
        cursor,
        limit: 20,
        modelProviders: null,
      };
      const response = await invoke<ThreadListResponse>("list_threads", {
        params,
      });
      setThreadCursor(response.nextCursor);
      setThreads((prev) =>
        cursor ? [...prev, ...response.data] : response.data,
      );
    } catch (error) {
      console.error("failed to list threads", error);
    } finally {
      setIsThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    invoke("initialize_client").catch((error) =>
      console.error("failed to initialize codex client", error),
    );

    const unlistenConversation = listen<StreamedEventNotification>(
      "codex://conversation-event",
      (event) => {
        addEvent(event.payload);
      },
    );

    return () => {
      unlistenConversation.then((fn) => fn());
    };
  }, [addEvent]);

  useEffect(() => {
    const unlistenApprovals = listen<ApprovalRequestNotification>(
      "codex://approval-request",
      (event) => {
        setApprovalRequests((prev) => [...prev, event.payload]);
      },
    );

    return () => {
      unlistenApprovals.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    loadThreads(null);
  }, [loadThreads]);

  const handleResumeThread = useCallback(
    async (threadId: string) => {
      setResumeStatus(null);
      setActiveConversationId(null);
      try {
        const params: ThreadResumeParams = {
          threadId,
          history: null,
          path: null,
          model: null,
          modelProvider: null,
          cwd: null,
          approvalPolicy: null,
          sandbox: null,
          config: null,
          baseInstructions: null,
          developerInstructions: null,
        };
        const response = await invoke<ThreadResumeResponse>("resume_thread", {
          params,
        });
        console.debug("resume", response)
        const conversationId = response.thread.id;
        setResumeStatus(`Resumed ${response.thread.preview || response.thread.id}`);
        setConversationEvents(
          conversationId,
          threadToEvents(response.thread),
        );
        setActiveConversationId(conversationId);
        await invoke("add_conversation_listener", {
          conversationId,
        });
        loadThreads(null);
      } catch (error) {
        console.error("failed to resume thread", error);
        setResumeStatus("Failed to resume thread.");
      } finally {
        console.debug("resume", threadId)
      }
    },
    [loadThreads, setConversationEvents, setActiveConversationId],
  );

  const handleThreadPreview = useCallback(
    (thread: Thread) => {
      if (activeConversationIds.includes(thread.id)) {
        setActiveConversationId(thread.id);
        return;
      }

      handleResumeThread(thread.id);
    },
    [activeConversationIds, handleResumeThread, setActiveConversationId],
  );

  const handleApprovalDecision = useCallback(
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

  const buildConversationParams = (): NewConversationParams =>
    getNewConversationParams(
      selectedProviderName,
      selectedModel,
      cwd ?? null,
      approvalPolicy,
      mode,
      {
        model_reasoning_effort: reasoningEffort,
      },
    );

  const ensureConversation = async (): Promise<string> => {
    if (activeConversationId) {
      return activeConversationId;
    }
    const params = buildConversationParams();
    const conversation = await invoke<NewConversationResponse>(
      "new_conversation",
      { params },
    );
    setConversationEvents(conversation.conversationId, []);
    setActiveConversationId(conversation.conversationId);
    await invoke("add_conversation_listener", {
      conversationId: conversation.conversationId,
    });
    return conversation.conversationId;
  };

  const newConversation = async () => {
    setActiveConversationId(null);
    await ensureConversation();
  };

  const sendUserMessage = async () => {
    if (!prompt.trim()) return;
    setSending(true);
    try {
      const conversationId = await ensureConversation();
      await invoke("send_user_message", {
        conversationId: conversationId,
        message: prompt,
      });
      setPrompt("");
    } catch (error) {
      console.error("failed to start conversation", error);
    } finally {
      setSending(false);
    }
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-screen">
      <ResizablePanel
        defaultSize={24}
        className="flex h-full flex-col gap-3 border-r border-muted/20 bg-muted/10"
      >
        <ThreadSidebar
          isThreadLoading={isThreadLoading}
          loadThreads={loadThreads}
          threadCursor={threadCursor}
          threads={threads}
          resumeStatus={resumeStatus}
          onSelectThread={handleThreadPreview}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={76} minSize={60}>
        <div className="flex h-full flex-col relative">
          <Button
            size="icon"
            onClick={newConversation}
          >
            <PencilIcon />
          </Button>
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            {approvalRequests.length > 0 && (
              <div className="space-y-3 px-4">
                {approvalRequests.map((request) => (
                  <ApprovalRequestCard
                    key={request.request_id}
                    request={request}
                    onDecision={handleApprovalDecision}
                    processing={processingApprovalIds.includes(request.request_id)}
                  />
                ))}
              </div>
            )}
            <ChatEvents events={events} />
          </div>
          {/* chat input  */}
          <div className="absolute bottom-0 w-full bg-background">
            <ChatInput
              prompt={prompt}
              onPromptChange={setPrompt}
              onSend={sendUserMessage}
              sending={sending}
            />
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

interface ApprovalRequestCardProps {
  request: ApprovalRequestNotification;
  processing: boolean;
  onDecision: (
    requestId: string,
    requestType: ApprovalRequestNotification["type"],
    decision: ReviewDecisionType,
  ) => void;
}

function ApprovalRequestCard({
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
      <p className="mt-1 text-sm font-medium break-words">
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
