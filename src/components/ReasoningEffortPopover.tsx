import { Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useConfigStore, type ReasoningEffort } from '@/stores/useConfigStore';
import { cn } from '@/lib/utils';

export function ReasoningEffortPopover() {
  const { reasoningEffort, setReasoningEffort } = useConfigStore();
  const efforts: ReasoningEffort[] = ['low', 'medium', 'high', 'xhigh'];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Brain className="h-4 w-4" />
          {reasoningEffort}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48">
        <div className="space-y-4">
          <h4 className="font-medium leading-none">Reasoning Effort</h4>

          <div className="space-y-2">
            {efforts.map((effort) => (
              <button
                key={effort}
                onClick={() => setReasoningEffort(effort)}
                className={cn("w-full text-left px-3 py-2 text-sm rounded hover:bg-accent",
                  reasoningEffort === effort && "bg-accent font-medium"
                )}
                >{effort}</button>
              ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
