import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SandboxMode } from '@/bindings/v2/SandboxMode';
import type { AskForApproval } from '@/bindings/v2/AskForApproval';

export type ModelProvider = 'ollama' | 'anthropic' | 'openai' | 'mock';
export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface ModelConfig {
  provider: ModelProvider;
  model: string;
}

export interface SandboxPolicyConfig {
  sandbox: SandboxMode;
  approvalPolicy: AskForApproval;
}

export interface ConfigStore {
  // Profile config
  modelProvider: ModelProvider;
  modelPerProvider: Record<ModelProvider, string>; // Remember last model per provider

  // Sandbox + Approval Policy
  sandbox: SandboxMode;
  approvalPolicy: AskForApproval;

  // Reasoning effort
  reasoningEffort: ReasoningEffort;

  // Actions
  setModelProvider: (provider: ModelProvider) => void;
  setModel: (model: string) => void;
  setSandboxMode: (sandbox: SandboxMode) => void;
  setApprovalPolicy: (approval: AskForApproval) => void;
  setReasoningEffort: (effort: ReasoningEffort) => void;
}

// Sandbox to ApprovalPolicy mapping
export const SANDBOX_APPROVAL_MAP: Record<SandboxMode, AskForApproval> = {
  'read-only': 'untrusted',
  'workspace-write': 'on-request',
  'danger-full-access': 'never',
};

// Available models per provider
export const PROVIDER_MODELS: Record<ModelProvider, string[]> = {
  openai: ['gpt-5.2', 'gpt-5.2-codex', 'gpt-5.2-codex-mini', 'gpt-5.2-codex-max'],
  ollama: ['qwen2.5-coder:0.5b', 'llama3.2'],
  anthropic: ['claude-4-5-sonnet', 'claude-4-5-opus', 'claude-4-5-haiku'],
  mock: ['llm'],
};

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set, get) => ({
      // Default values
      modelProvider: 'ollama',
      modelPerProvider: {
        ollama: 'qwen2.5-coder:0.5b',
        anthropic: 'claude-3-5-sonnet-20241022',
        openai: 'gpt-4',
        mock: 'llm'
      },
      sandbox: 'read-only',
      approvalPolicy: 'untrusted',
      reasoningEffort: 'medium',

      setModelProvider: (provider: ModelProvider) => {
        set({ modelProvider: provider });
      },

      setModel: (model: string) => {
        const { modelProvider, modelPerProvider } = get();
        set({
          modelPerProvider: {
            ...modelPerProvider,
            [modelProvider]: model,
          },
        });
      },

      setSandboxMode: (sandbox: SandboxMode) => {
        set({ sandbox, approvalPolicy: SANDBOX_APPROVAL_MAP[sandbox] });
      },

      setApprovalPolicy: (approval: AskForApproval) => {
        set({ approvalPolicy: approval });
      },

      setReasoningEffort: (effort: ReasoningEffort) => {
        set({ reasoningEffort: effort });
      },
    }),
    {
      name: 'codex-config-storage',
    }
  )
);
