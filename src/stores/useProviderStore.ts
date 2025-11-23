import { create } from "zustand";

export interface ProviderConfig {
  name: string;
}

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    name: "openai",
  },
];

const mergeProvidersWithDefaults = (
  providers: ProviderConfig[],
): ProviderConfig[] => {
  const providerMap = new Map<string, ProviderConfig>();

  providers.forEach((provider) => {
    providerMap.set(provider.name, provider);
  });

  DEFAULT_PROVIDERS.forEach((provider) => {
    if (!providerMap.has(provider.name)) {
      providerMap.set(provider.name, provider);
    }
  });

  return Array.from(providerMap.values());
};

type ProviderState = {
  providers: ProviderConfig[];
};

type ProviderActions = {
  setProviders: (providers: ProviderConfig[]) => void;
};

export const useProviderStore = create<ProviderState & ProviderActions>(
  (set) => ({
    providers: DEFAULT_PROVIDERS,
    setProviders: (providers) => {
      const normalized =
        providers.length > 0 ? mergeProvidersWithDefaults(providers) : DEFAULT_PROVIDERS;
      set({ providers: normalized });
    },
  }),
);

export { DEFAULT_PROVIDERS, mergeProvidersWithDefaults };
