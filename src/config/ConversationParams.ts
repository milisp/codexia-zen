import { NewConversationParams } from "@/bindings/NewConversationParams";
import { AskForApproval } from "@/bindings/AskForApproval";

export type mode = "chat" | "agent" | "agent-full";
export const APPROVAL_POLICIES: AskForApproval[] = [
  "untrusted",
  "on-failure",
  "on-request",
  "never",
];

export const MODE_OPTIONS: Array<{
  value: mode;
  selectorLabel: string;
}> = [
  { value: "chat", selectorLabel: "Chat" },
  { value: "agent", selectorLabel: "Agent" },
  { value: "agent-full", selectorLabel: "Agent (Full)" },
];

export const SANDBOX_MODES: Record<
  mode,
  {
    label: string;
    defaultApprovalPolicy: AskForApproval;
  }
> = {
  chat: {
    label: "Read Only",
    defaultApprovalPolicy: "untrusted",
  },
  agent: {
    label: "Workspace Write",
    defaultApprovalPolicy: "on-request",
  },
  "agent-full": {
    label: "Full Access",
    defaultApprovalPolicy: "never",
  },
};

export const getNewConversationParams = (
  provider: any, // Replace 'any' with the actual type of provider
  selectedModel: string | null,
  cwd: string | null,
  approvalPolicy: AskForApproval,
  mode: mode
): NewConversationParams => {
  return {
    profile: provider?.id ?? null,
    model: selectedModel,
    cwd: cwd,
    approvalPolicy: approvalPolicy,
    sandbox: mode === "chat" ? "read-only" : mode === "agent" ? "workspace-write" : "danger-full-access",
    includePlanTool: true,
    includeApplyPatchTool: true,
    config: {
      "show_raw_agent_reasoning": true
    },
    baseInstructions: null,
  };
};
