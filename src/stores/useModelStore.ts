import { create } from "zustand";
import { persist } from "zustand/middleware";

const DEFAULT_MODEL_MAP: Record<string, string[]> = {
  openai: ["gpt-5.1", "gpt-5.1-codex", "gpt-5.1-codex-mini"],
  google: ["gemini-2.5-pro", "gemini-2.5-flash"],
  openrouter: ["openai/gpt-oss-20b:free", "qwen/qwen3-coder:free"],
  hf: ["openai/gpt-oss-20b"],
};

const cloneDefaultModels = () =>
  Object.entries(DEFAULT_MODEL_MAP).reduce<Record<string, string[]>>(
    (acc, [key, models]) => {
      acc[key] = [...models];
      return acc;
    },
    {},
  );

export const getDefaultModelsForProvider = (providerId: string | null): string[] => {
  if (!providerId) {
    return [];
  }

  return [...(DEFAULT_MODEL_MAP[providerId] ?? [])];
};

type ModelState = {
  modelsByProvider: Record<string, string[]>;
};

type ModelActions = {
  addModel: (providerId: string, model: string) => void;
  removeModel: (providerId: string, model: string) => void;
  setModelsForProvider: (providerId: string, models: string[]) => void;
  ensureProviderModels: (providerId: string) => void;
};

export const useModelStore = create<ModelState & ModelActions>()(
  persist(
    (set) => ({
      modelsByProvider: cloneDefaultModels(),
      addModel: (providerId, model) => {
        const trimmed = model.trim();
        if (!trimmed) {
          return;
        }
        set((state) => {
          const existing = state.modelsByProvider[providerId] ?? [];
          if (existing.includes(trimmed)) {
            return state;
          }
          return {
            modelsByProvider: {
              ...state.modelsByProvider,
              [providerId]: [...existing, trimmed],
            },
          };
        });
      },
      removeModel: (providerId, model) => {
        set((state) => {
          const existing = state.modelsByProvider[providerId];
          if (!existing) {
            return state;
          }
          const updated = existing.filter((item) => item !== model);
          return {
            modelsByProvider: {
              ...state.modelsByProvider,
              [providerId]: updated,
            },
          };
        });
      },
      setModelsForProvider: (providerId, models) => {
        set((state) => ({
          modelsByProvider: {
            ...state.modelsByProvider,
            [providerId]: [...models],
          },
        }));
      },
      ensureProviderModels: (providerId) => {
        set((state) => {
          if (state.modelsByProvider[providerId]) {
            return state;
          }
          return {
            modelsByProvider: {
              ...state.modelsByProvider,
              [providerId]: getDefaultModelsForProvider(providerId),
            },
          };
        });
      },
    }),
    {
      name: "models",
    },
  ),
);
