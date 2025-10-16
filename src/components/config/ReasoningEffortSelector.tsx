import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Brain, ChevronDown } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { useProviderStore } from '@/stores/useProviderStore';

const EFFORT_OPTIONS = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const;

export const ReasoningEffortSelector: React.FC = () => {
  const {
    reasoningEffort,
    setReasoningEffort,
    selectedModel,
    selectedProviderId,
  } = useProviderStore();
  const [isOpen, setIsOpen] = useState(false);

  const allowedEfforts = useMemo(() => {
    const provider = selectedProviderId?.toLowerCase();
    if (provider === 'openai' && selectedModel === 'gpt-5-codex') {
      return EFFORT_OPTIONS.filter((effort) => effort.value !== 'minimal');
    }
    return EFFORT_OPTIONS;
  }, [selectedModel, selectedProviderId]);

  useEffect(() => {
    const isCurrentEffortAllowed = allowedEfforts.some(
      (effort) => effort.value === reasoningEffort,
    );

    if (!isCurrentEffortAllowed && allowedEfforts.length > 0) {
      const fallbackEffort =
        allowedEfforts.find((effort) => effort.value === 'medium') ??
        allowedEfforts[0];
      setReasoningEffort(fallbackEffort.value);
    }
  }, [allowedEfforts, reasoningEffort, setReasoningEffort]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
        >
          <Brain />
          <span className="capitalize">{reasoningEffort}</span>
          <ChevronDown className="w-3 h-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-2" align="start">
        <div className="space-y-1">
          <div>
            Reasoning Effort
          </div>
          {allowedEfforts.map((effort) => (
            <Button
              key={effort.value}
              variant={reasoningEffort === effort.value ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start text-left p-2"
              onClick={() => {
                setReasoningEffort(effort.value);
                setIsOpen(false);
              }}
            >
              {effort.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
