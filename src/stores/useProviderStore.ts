import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface ModelProvider {
  id: string;
  name: string;
  models: string[];
  apiKey: string;
}

type ProviderState = {
  providers: ModelProvider[];
  selectedProviderId: string | null;
  selectedModel: string | null;
};

type ProviderActions = {
  addProvider: (provider: { name: string; models: string[] }) => void;
  setApiKey: (id: string, key: string) => void;
  setSelectedProviderId: (id: string) => void;
  setSelectedModel: (model: string) => void;
  addModel: (providerId: string, model: string) => void;
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
    name: "OpenAI",
    models: ["gpt-5", "gpt-5-codex"],
    apiKey: "",
  },
  {
    id: "ollama",
    name: "Ollama",
    models: ossModels,
    apiKey: "",
  },
  {
    id: "google",
    name: "Google",
    models: ["gemini-2.5-pro", "gemini-2.5-flash"],
    apiKey: "",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    models: ["openai/gpt-oss-20b:free", "qwen/qwen3-coder:free"],
    apiKey: "",
  },
];

export const useProviderStore = create<ProviderState & ProviderActions>()(
  persist(
    (set, get) => ({
      providers: initialProviders,
      selectedProviderId: initialProviders[0].id,
      selectedModel: initialProviders[0].models[0],

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
      setApiKey: (id, key) => {
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === id ? { ...p, apiKey: key } : p,
          ),
        }));
      },
      addProvider: (providerData) => {
        const newProvider: ModelProvider = {
          ...providerData,
          id: providerData.name.toLowerCase().replace(/\s+/g, "-"),
          apiKey: "",
        };
        set((state) => ({
          providers: [...state.providers, newProvider],
        }));
      },
      addModel: (providerId, model) => {
        set((state) => ({
          providers: state.providers.map((p) =>
            p.id === providerId ? { ...p, models: [...p.models, model] } : p,
          ),
        }));
      },
    }),
    {
      name: "provider",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
