import { Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useConfigStore } from '@/stores/useConfigStore';
import { cn } from '@/lib/utils';

export function ProfilePopover() {
  const { modelProvider, modelPerProvider, providerModels, setModelProvider, setModel, initializeModels } = useConfigStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeModels();
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [initializeModels]);

  const currentModel = modelPerProvider[modelProvider];
  const providers = Object.keys(providerModels);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          {modelPerProvider[modelProvider]}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="flex divide-x">
        {/* Left: Providers */}
        <div className="w-[140px] p-2 space-y-1">
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Provider</div>
          {providers.map((provider) => (
            <button
              key={provider}
              onClick={() => setModelProvider(provider)}
              className={cn(
                "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent",
                modelProvider === provider && "bg-accent font-medium"
              )}
            >
              {provider}
            </button>
          ))}
          </div>

          {/* Right: Models */}
          <div className="flex-1 p-2 space-y-1">
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Model</div>
            {providerModels[modelProvider]?.map((model) => (
              <button
                key={model}
                onClick={() => setModel(model)}
                className={cn(
                  "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent truncate",
                  currentModel === model && "bg-accent font-medium"
                )}
              >
                {model}
              </button>
            ))}
          </div>
        </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
