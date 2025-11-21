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

const defaultConfig = {
  model_reasoning_effort: "medium",
  show_raw_agent_reasoning: true,
  model_reasoning_summary: "auto",
};

export const getNewConversationParams = (
  provider: any, // Replace 'any' with the actual type of provider
  selectedModel: string | null,
  cwd: string | null,
  approvalPolicy: AskForApproval,
  mode: mode,
  config?: Record<string, any> | null,
): NewConversationParams => {
  const mergeConfig = config
    ? {
        ...defaultConfig,
        ...config,
      }
    : defaultConfig;
  return {
    model: selectedModel,
    profile: provider?.id ?? null,
    modelProvider: null,
    cwd,
    approvalPolicy: approvalPolicy,
    sandbox:
      mode === "chat"
        ? "read-only"
        : mode === "agent"
          ? "workspace-write"
          : "danger-full-access",
    includeApplyPatchTool: true,
    config: mergeConfig,
    baseInstructions: null,
    developerInstructions: null,
    compactPrompt: null,
  };
};
