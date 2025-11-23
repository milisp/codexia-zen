import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { invoke } from "@tauri-apps/api/core";
import {
  DEFAULT_PROVIDERS,
  useProviderStore,
} from "@/stores/useProviderStore";
import {
  getDefaultModelsForProvider,
  useModelStore,
} from "@/stores/useModelStore";
import { useCodexStore } from "@/stores/useCodexStore";

const formatProviderLabel = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const mergeProvidersWithDefaults = (providers: string[]): string[] => {
  const providerSet = new Set(providers);
  const normalized = [...providers];
  DEFAULT_PROVIDERS.forEach((provider) => {
    if (!providerSet.has(provider)) {
      normalized.push(provider);
    }
  });
  return normalized;
};

export const ProviderModelSelector: React.FC = () => {
  const {
    providers,
    setProviders,
  } = useProviderStore();
  const {
    selectedModel,
    setSelectedModel,
    selectedProvider,
    setSelectedProvider,
  } = useCodexStore();
  const {
    modelsByProvider,
    addModel,
    removeModel,
    ensureProviderModels,
  } = useModelStore();
  const [ossModels, setOssModels] = useState<string[]>([]);

  const [open, setOpen] = useState(false);
  const [newModel, setNewModel] = useState("");

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const response = await invoke<Record<string, unknown>>(
          "read_providers",
        );
        console.debug(Object.keys(response))
        const parsedProviders = Object.keys(response).map((id) => id);
        const normalized = mergeProvidersWithDefaults(parsedProviders);
        setProviders(normalized);
        normalized.forEach((provider) => {
          if (provider !== "ollama") {
            ensureProviderModels(provider);
          }
        });
      } catch (error) {
        console.error("failed to load provider config", error);
      }
    };

    loadProviders();
  }, [ensureProviderModels, setProviders]);

  useEffect(() => {
    if (!providers.length) {
      return;
    }
    if (
      !selectedProvider ||
      !providers.includes(selectedProvider)
    ) {
      setSelectedProvider(providers[0]);
    }
  }, [providers, selectedProvider, setSelectedProvider]);

  useEffect(() => {
    providers
      .filter((provider) => provider !== "ollama")
      .forEach((provider) => ensureProviderModels(provider));
  }, [ensureProviderModels, providers]);

  const providerName = selectedProvider ?? "";
  const isOllamaProvider =
    providerName.trim().toLowerCase() === "ollama";
  const providerModels =
    providerName && providerName in modelsByProvider
      ? modelsByProvider[providerName]
      : undefined;
  const availableModels =
    isOllamaProvider
      ? ossModels
      : providerModels !== undefined
        ? providerModels
        : getDefaultModelsForProvider(providerName);

  useEffect(() => {
    if (!providerName || selectedModel) {
      return;
    }
    if (isOllamaProvider) {
      if (!ossModels.length) {
        return;
      }
      setSelectedModel(ossModels[0] ?? null);
      return;
    }
    const stored =
      providerName in modelsByProvider
        ? modelsByProvider[providerName]
        : getDefaultModelsForProvider(providerName);
    setSelectedModel(stored[0] ?? null);
  }, [
    modelsByProvider,
    providerName,
    selectedModel,
    setSelectedModel,
    ossModels,
    isOllamaProvider,
  ]);

  const getOssModels = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:11434/v1/models");
      if (!response.ok) {
        throw new Error("Unable to fetch Ollama models");
      }
      const data = await response.json();
      const remoteModels = data?.data?.map((item: any) => item.id) ?? [];
      setOssModels(remoteModels);
    } catch (error) {
      console.error("Failed to fetch Ollama models:", error);
      setOssModels([]);
    }
  }, []);

  useEffect(() => {
    const isOllama =
      (selectedProvider ?? "").trim().toLowerCase() === "ollama";
    if (isOllama) {
      void getOssModels();
    }
  }, [selectedProvider, getOssModels]);
  const displayModel =
    selectedModel ?? availableModels[0] ?? "Select a model";
  const handleProviderSelect = (name: string) => {
    setSelectedProvider(name);
    const isOllama =
      name.trim().toLowerCase() === "ollama";
    if (isOllama) {
      setSelectedModel(null);
      void getOssModels();
      return;
    }
    const storedModels =
      name && name in modelsByProvider
        ? modelsByProvider[name]
        : getDefaultModelsForProvider(name);
    setSelectedModel(storedModels[0] ?? null);
  };

  const handleAddModel = () => {
    if (!providerName || isOllamaProvider) {
      return;
    }
    const trimmed = newModel.trim();
    if (!trimmed) {
      return;
    }
    if (availableModels.includes(trimmed)) {
      setSelectedModel(trimmed);
      setNewModel("");
      return;
    }
    addModel(providerName, trimmed);
    setSelectedModel(trimmed);
    setNewModel("");
  };

  const handleRemoveModel = (model: string) => {
    if (!providerName || isOllamaProvider) {
      return;
    }
    const remaining = availableModels.filter((entry) => entry !== model);
    removeModel(providerName, model);
    if (selectedModel === model) {
      setSelectedModel(remaining[0] ?? null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="flex items-center gap-1 px-3" size="sm">
          <span className="text-xs text-muted-foreground uppercase">
            {displayModel}
          </span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[520px] p-4">
        <div className="grid grid-cols-[160px_1fr] gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Providers
            </p>
            <div className="space-y-1 max-h-[280px] overflow-y-auto">
              {providers.map((provider) => (
                <Button
                  key={provider}
                  variant={provider === selectedProvider ? "default" : "ghost"}
                  size="sm"
                  className="w-full justify-start text-left"
                  onClick={() => {
                    handleProviderSelect(provider);
                  }}
                >
                  {formatProviderLabel(provider)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add model"
                value={newModel}
                onChange={(event) => setNewModel(event.target.value)}
                disabled={isOllamaProvider}
                className="flex-1 rounded border border-input px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/70 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <Button
                size="sm"
                onClick={handleAddModel}
                disabled={!newModel.trim() || !providerName || isOllamaProvider}
              >
                Add
              </Button>
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Models
            </p>
            <div className="space-y-1 max-h-[280px] overflow-y-auto">
              {availableModels.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No models available yet.
                </p>
              )}
              {availableModels.map((model) => (
                <div key={model} className="flex items-center gap-2">
                  <Button
                    variant={model === selectedModel ? "default" : "ghost"}
                    size="sm"
                    className="flex-1 justify-between text-left"
                    onClick={() => {
                      setSelectedModel(model);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{model}</span>
                  </Button>
                  {!isOllamaProvider && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 p-0"
                      aria-label={`Remove ${model}`}
                      onClick={() => handleRemoveModel(model)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
