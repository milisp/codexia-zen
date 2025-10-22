import { create } from "zustand";

export type ExecApprovalRequest = {
  requestToken: string;
  conversationId: string;
  callId: string;
  command: string[];
  cwd: string;
  reason: string | null;
  createdAt: number;
};

interface ApprovalState {
  execRequests: Record<string, ExecApprovalRequest>;
  upsertExecRequest: (request: ExecApprovalRequest) => void;
  removeExecRequest: (callId: string) => void;
  clearAll: () => void;
}

export const useApprovalStore = create<ApprovalState>((set) => ({
  execRequests: {},
  upsertExecRequest: (request) =>
    set((state) => ({
      execRequests: {
        ...state.execRequests,
        [request.callId]: request,
      },
    })),
  removeExecRequest: (callId) =>
    set((state) => {
      if (!state.execRequests[callId]) {
        return state;
      }
      const { [callId]: _removed, ...rest } = state.execRequests;
      return {
        execRequests: rest,
      };
    }),
  clearAll: () => set({ execRequests: {} }),
}));
