import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SandboxMode } from '@/bindings/v2/SandboxMode';
import type { AskForApproval } from '@/bindings/v2/AskForApproval';
import { readTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';

export type ModelProvider = string;
export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

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
  modelPerProvider: Record<string, string>; // Remember last model per provider
  providerModels: Record<string, string[]>; // Available models per provider (not persisted)

  // Sandbox + Approval Policy
  sandbox: SandboxMode;
  approvalPolicy: AskForApproval;

  // Reasoning effort
  reasoningEffort: ReasoningEffort;

  cwd: string;

  // Actions
  setModelProvider: (provider: ModelProvider) => void;
  setModel: (model: string) => void;
  setSandboxMode: (sandbox: SandboxMode) => void;
  setApprovalPolicy: (approval: AskForApproval) => void;
  setReasoningEffort: (effort: ReasoningEffort) => void;
  setCwd: (cwd: string) => void;
  initializeModels: () => Promise<void>;
}

// Sandbox to ApprovalPolicy mapping
export const SANDBOX_APPROVAL_MAP: Record<SandboxMode, AskForApproval> = {
  'read-only': 'untrusted',
  'workspace-write': 'on-request',
  'danger-full-access': 'never',
};

// Default models when profile.json doesn't exist
const DEFAULT_PROVIDER_MODELS: Record<string, string[]> = {
  openai: ["gpt-5.1-codex", "gpt-5.1-codex-max", "gpt-5.1-codex-mini", "gpt-5.1", "gpt-5.2"],
};

// Load provider models from ~/.codex/profile.json
async function loadProviderModels(): Promise<Record<string, string[]>> {
  try {
    const profileJson = await readTextFile('.codex/profile.json', {
      baseDir: BaseDirectory.Home,
    });
    const profile = JSON.parse(profileJson) as Record<string, string[]>;
    return profile;
  } catch (error) {
    console.error('Failed to load profile.json:', error);
    // Fallback to default
    return DEFAULT_PROVIDER_MODELS;
  }
}

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set, get) => ({
      // Default values
      modelProvider: 'openai',
      modelPerProvider: {},
      providerModels: DEFAULT_PROVIDER_MODELS, // Not persisted
      sandbox: 'read-only',
      approvalPolicy: 'untrusted',
      reasoningEffort: 'medium',
      cwd: "/",

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

      setCwd: (cwd: string) => {
        set({ cwd: cwd });
      },

      initializeModels: async () => {
        const models = await loadProviderModels();
        const { modelProvider, modelPerProvider } = get();

        // Update provider models
        set({ providerModels: models });

        // Set default model for current provider if not set
        if (!modelPerProvider[modelProvider] && models[modelProvider]?.[0]) {
          set({
            modelPerProvider: {
              ...modelPerProvider,
              [modelProvider]: models[modelProvider][0],
            },
          });
        }
      },
    }),
    {
      name: 'codex-config-storage',
      partialize: (state) => {
        // Exclude providerModels from persistence
        const { providerModels, ...rest } = state;
        return rest;
      },
    }
  )
);
