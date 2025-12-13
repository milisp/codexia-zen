import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface ApprovalRequest {
  requestId: string;
  threadId: string;
  turnId: string;
  itemId: string;
  reason?: string;
  type: 'commandExecution' | 'fileChange';
  proposedExecpolicyAmendment?: string[];
  grantRoot?: string;
}

interface ApprovalStore {
  // State
  pendingApprovals: ApprovalRequest[];
  currentApproval: ApprovalRequest | null;

  // Actions
  addApproval: (approval: ApprovalRequest) => void;
  respondToApproval: (
    requestId: string,
    decision: 'accept' | 'acceptForSession' | 'decline' | 'cancel',
    isCommandExecution: boolean,
    execpolicyAmendment?: string[]
  ) => Promise<void>;
  clearCurrent: () => void;
}

export const useApprovalStore = create<ApprovalStore>((set, _get) => ({
  // Initial state
  pendingApprovals: [],
  currentApproval: null,

  // Actions
  addApproval: (approval) => {
    set((state) => ({
      pendingApprovals: [...state.pendingApprovals, approval],
      currentApproval: state.currentApproval || approval,
    }));
  },

  respondToApproval: async (requestId, decision, isCommandExecution, execpolicyAmendment) => {
    try {
      let approvalDecision: any;

      if (decision === 'accept') {
        approvalDecision = { accept: null };
      } else if (decision === 'acceptForSession') {
        approvalDecision = { acceptForSession: null };
      } else if (decision === 'decline') {
        approvalDecision = { decline: null };
      } else if (decision === 'cancel') {
        approvalDecision = { cancel: null };
      }

      if (execpolicyAmendment) {
        approvalDecision = {
          acceptWithExecpolicyAmendment: { execpolicyAmendment },
        };
      }

      const response = {
        requestId,
        decision: approvalDecision,
        isCommandExecution,
      };

      await invoke('respond_to_approval', { response });

      // Remove from pending
      set((state) => {
        const pending = state.pendingApprovals.filter((a) => a.requestId !== requestId);
        return {
          pendingApprovals: pending,
          currentApproval: pending[0] || null,
        };
      });
    } catch (error: any) {
      console.error('Failed to respond to approval:', error);
      throw error;
    }
  },

  clearCurrent: () => {
    set((state) => ({
      currentApproval: state.pendingApprovals[1] || null,
      pendingApprovals: state.pendingApprovals.slice(1),
    }));
  },
}));
