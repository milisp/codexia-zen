import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ModelProvider {
  id: string;
  models: string[];
}

type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';

type ProviderState = {
  providers: ModelProvider[];
  selectedProviderId: string | null;
  selectedModel: string | null;
  reasoningEffort: ReasoningEffort;
};

type ProviderActions = {
  setSelectedProviderId: (id: string) => void;
  setSelectedModel: (model: string) => void;
  addModel: (providerId: string, model: string) => void;
  setReasoningEffort: (effort: ReasoningEffort) => void;
};

let ossModels: string[] = []
fetch("http://localhost:11434/v1/models")
  .then(resp => resp.json())
  .then(data => 
    ossModels = data.data.map((item: any) => item.id)
  )

const initialProviders: ModelProvider[] = [
  {
    id: "openai",
    models: ["gpt-5", "gpt-5-codex"],
  },
  {
    id: "ollama",
    models: ossModels,
  },
  {
    id: "google",
    models: ["gemini-2.5-pro", "gemini-2.5-flash"],
  },
  {
    id: "openrouter",
    models: ["openai/gpt-oss-20b:free", "qwen/qwen3-coder:free"],
  },
  {
    id: "hf",
    models: ["openai/gpt-oss-20b"],
  },
]

export const useProviderStore = create<ProviderState & ProviderActions>()(
  persist(
    (set, get) => ({
      providers: initialProviders,
      selectedProviderId: initialProviders[0].id,
      selectedModel: initialProviders[0].models[0],
      reasoningEffort: 'medium',

      setSelectedProviderId: (id: string) => {
        const provider = get().providers.find((p) => p.id === id);
        if (provider) {
          set({
            selectedProviderId: id,
            selectedModel: provider.models[0] ?? null,
          });
        }
      },
      setSelectedModel: (model) => set({ selectedModel: model }),
      addModel: (providerId, model) => {
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === providerId ? { ...p, models: [...p.models, model] } : p,
          ),
        }));
      },
      setReasoningEffort: (effort) => set({ reasoningEffort: effort }),    }),
    {
      name: "provider"
    },
  ),
);
