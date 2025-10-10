
import { useProviderStore } from "@/stores/useProviderStore";
import { NewConversationParams } from "@/bindings/NewConversationParams";

export const getNewConversationParams = (): NewConversationParams => {
  const { providers, selectedProviderId } = useProviderStore.getState();
  const provider = providers.find(p => p.id === selectedProviderId);
  const selectedModel = useProviderStore.getState().selectedModel;

  return {
    profile: provider?.id ?? null,
    model: selectedModel,
    cwd: "/Users/gpt/pylang/demo",
    approvalPolicy: "on-request",
    sandbox: "workspace-write",
    includePlanTool: true,
    includeApplyPatchTool: true,
    config: null,
    baseInstructions: null,
  };
};
