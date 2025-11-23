import { create } from "zustand";

const DEFAULT_PROVIDERS = ["openai"];

type ProviderState = {
  providers: string[];
};

type ProviderActions = {
  setProviders: (providers: string[]) => void;
};

export const useProviderStore = create<ProviderState & ProviderActions>(
  (set) => ({
    providers: DEFAULT_PROVIDERS,
    setProviders: (providers) => {
      set({ providers: providers.length > 0 ? providers : DEFAULT_PROVIDERS });
    },
  }),
);

export { DEFAULT_PROVIDERS };
