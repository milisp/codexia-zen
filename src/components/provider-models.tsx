import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProviderStore } from "@/stores/useProviderStore";
import { ChevronDown, PlusCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

function AddProviderForm({ onAdd }: { onAdd: () => void }) {
  const [name, setName] = useState("");
  const [models, setModels] = useState("");
  const addProvider = useProviderStore((s) => s.addProvider);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !models) return;
    addProvider({
      name,
      models: models
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
    });
    onAdd();
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <div className="space-y-2">
        <Label>Provider Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., My Custom AI"
        />
      </div>
      <div className="space-y-2">
        <Label>Models (comma-separated)</Label>
        <Input
          value={models}
          onChange={(e) => setModels(e.target.value)}
          placeholder="model-1, model-2"
        />
      </div>
      <Button type="submit" size="sm" className="w-full">
        Add Provider
      </Button>
    </form>
  );
}

function AddModelForm({
  providerId,
  onAdd,
}: {
  providerId: string;
  onAdd: () => void;
}) {
  const [modelName, setModelName] = useState("");
  const addModel = useProviderStore((s) => s.addModel);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName) return;
    addModel(providerId, modelName.trim());
    setModelName("");
    onAdd();
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <div className="space-y-2">
        <Label>Model Name</Label>
        <Input
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder="e.g., new-model-v1"
        />
      </div>
      <Button type="submit" size="sm" className="w-full">
        Add Model
      </Button>
    </form>
  );
}

export function ProviderModels() {
  const {
    providers,
    selectedProviderId,
    selectedModel,
    setSelectedProviderId,
    setSelectedModel,
    setApiKey,
  } = useProviderStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddModelForm, setShowAddModelForm] = useState(false);

  const selectedProvider = providers.find((p) => p.id === selectedProviderId);

  const currentApiKey = selectedProvider?.apiKey ?? "";
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log(selectedProviderId);
    if (selectedProviderId) {
      setApiKey(selectedProviderId, e.target.value);
    }
  };

  return (
    <Popover
      onOpenChange={() => {
        setShowAddForm(false);
        setShowAddModelForm(false);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <span className="font-medium">{selectedModel ?? "Select Model"}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[480px] p-0" align="end">
        <div className="p-4 pb-3">
          <h3 className="font-semibold text-lg">Model Settings</h3>
        </div>
        <Separator />
        <div className="flex h-96">
          {/* Left: Providers */}
          <div className="w-36 border-r">
            <div className="flex items-center justify-between p-3">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Providers
              </Label>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                <PlusCircle className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="h-[370px]">
              {showAddForm ? (
                <AddProviderForm onAdd={() => setShowAddForm(false)} />
              ) : (
                <div className="px-2 pb-2 space-y-1">
                  {providers.map((p) => (
                    <Button
                      key={p.id}
                      variant={
                        p.id === selectedProviderId ? "secondary" : "ghost"
                      }
                      size="sm"
                      className="w-full justify-start relative"
                      onClick={() => {
                        setSelectedProviderId(p.id);
                        setShowAddModelForm(false); // Hide add model form when changing provider
                      }}
                    >
                      {p.name}
                    </Button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right: API Key & Models */}
          <div className="flex-1 flex flex-col">
            {/* Top: API Key */}
            <div className="p-4 space-y-3">
              {selectedProviderId !== "ollama" && (
                <>
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    API Key
                  </Label>
                  <div className="space-y-2">
                    <Input
                      type="password"
                      placeholder="api key"
                      value={currentApiKey}
                      onChange={handleApiKeyChange}
                      className="font-mono text-xs"
                      disabled={!selectedProviderId}
                    />
                  </div>
                </>
              )}
            </div>

            <Separator />

            {/* Bottom: Models */}
            <div className="flex-1 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Models
                </Label>
                {selectedProviderId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowAddModelForm(!showAddModelForm)}
                  >
                    <PlusCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {selectedProviderId && showAddModelForm ? (
                <AddModelForm
                  providerId={selectedProviderId}
                  onAdd={() => setShowAddModelForm(false)}
                />
              ) : (
                selectedProvider && (
                  <ScrollArea className="h-64 rounded-md border">
                    <div className="p-2 space-y-1">
                      {selectedProvider.models.map((m) => (
                        <Button
                          key={m}
                          variant={m === selectedModel ? "secondary" : "ghost"}
                          size="sm"
                          className="w-full justify-start font-mono text-xs relative"
                          onClick={() => setSelectedModel(m)}
                        >
                          {m}
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                )
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
