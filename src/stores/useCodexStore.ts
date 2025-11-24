import { create } from "zustand";
import { persist } from "zustand/middleware";

type ReasoningEffort = "minimal" | "low" | "medium" | "high";
export type isBusyOffMsgType =
  | "task_complete"
  | "error"
  | "apply_patch_approval_request"
  | "exec_approval_request"
  | "turn_aborted";

export const isBusyOffMsgTypes: isBusyOffMsgType[] = [
  "task_complete",
  "error",
  "apply_patch_approval_request",
  "exec_approval_request",
  "turn_aborted",
];

interface CodexState {
  cwd: string | null;
  isInitializing: boolean;
  isSending: boolean;
  reasoningEffort: ReasoningEffort;
  selectedModel: string | null;
  selectedProvider: string | null;
}

interface CodexActions {
  setCwd: (cwd: string | null) => void;
  setIsInitializing: (value: boolean) => void;
  setIsSending: (value: boolean) => void;
  setReasoningEffort: (effort: ReasoningEffort) => void;
  setSelectedModel: (model: string | null) => void;
  setSelectedProvider: (provider: string) => void;
}

export const useCodexStore = create<CodexState & CodexActions>()(
  persist(
    (set) => ({
      cwd: null,
      isInitializing: false,
      isSending: false,
      reasoningEffort: "medium",
      selectedModel: "gpt-5.1-codex-mini",
      selectedProvider: "openai",
      setCwd: (cwd) => set({ cwd }),
      setIsInitializing: (value) => set({ isInitializing: value }),
      setIsSending: (value) => set({ isSending: value }),
      setReasoningEffort: (effort: ReasoningEffort) => {
        set({ reasoningEffort: effort });
      },
      setSelectedModel: (model: string | null) => {
        set({ selectedModel: model });
      },
      setSelectedProvider: (provider: string) => {
        set({ selectedProvider: provider });
      },
    }),
    {
      name: "codex-meta",
    },
  ),
);
