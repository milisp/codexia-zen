import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { ChatEvent } from '@/types/ChatEvent';
import type { Thread } from '@/bindings/v2/Thread';
import type { Turn } from '@/bindings/v2/Turn';
import type { ThreadStartParams } from '@/bindings/v2/ThreadStartParams';
import type { ThreadStartResponse } from '@/bindings/v2/ThreadStartResponse';
import type { ThreadResumeParams } from '@/bindings/v2/ThreadResumeParams';
import type { ThreadResumeResponse } from '@/bindings/v2/ThreadResumeResponse';
import type { TurnStartParams } from '@/bindings/v2/TurnStartParams';
import type { TurnStartResponse } from '@/bindings/v2/TurnStartResponse';
import type { TurnInterruptParams } from '@/bindings/v2/TurnInterruptParams';
import type { UserInput } from '@/bindings/v2/UserInput';

interface CodexStore {
  // State
  threads: Thread[];
  currentThreadId: string | null;
  currentTurnId: string | null;
  isProcessing: boolean;
  error: string | null;
  events: Record<string, ChatEvent[]>; // Events per thread
  activeThreadIds: string[]; // Track resumed/active threads

  // Actions
  threadStart: (params: ThreadStartParams) => Promise<Thread>;
  threadResume: (threadId: string) => Promise<void>;
  turnStart: (threadId: string, input: string) => Promise<Turn>;
  turnInterrupt: (threadId: string, turnId: string) => Promise<void>;
  setCurrentThread: (threadId: string | null) => Promise<void>;
  setThreads: (threads: Thread[]) => void;
  addEvent: (threadId: string, event: ChatEvent) => void;
  clearError: () => void;
}

export const useCodexStore = create<CodexStore>((set, get) => ({
  threads: [],
  currentThreadId: null,
  currentTurnId: null,
  isProcessing: false,
  error: null,
  events: {},
  activeThreadIds: [],

  threadStart: async (params: ThreadStartParams) => {
    console.log('[Store] threadStart called with params:', params);
    try {
      console.log('[Store] Setting isProcessing to true');
      set({ error: null, isProcessing: true });

      console.log('[Store] Calling backend thread_start...');
      const response = await invoke<ThreadStartResponse>('thread_start', {params});
      console.log('[Store] Backend response:', response);

      const thread = response.thread;

      set((state) => ({
        threads: [thread, ...state.threads],
        currentThreadId: thread.id,
        isProcessing: false,
        activeThreadIds: [...state.activeThreadIds, thread.id],
        events: { ...state.events, [thread.id]: [] },
      }));

      console.log('[Store] threadStart completed successfully isProcessing false');
      return thread;
    } catch (error: any) {
      console.error('[Store] threadStart error:', error);
      set({ error: error.message || 'Failed to start thread', isProcessing: false });
      throw error;
    }
  },

  threadResume: async (threadId: string) => {
    try {
      set({ error: null, isProcessing: true });
      const params: ThreadResumeParams = {
        threadId,
        history: null,
        path: null,
        model: null,
        modelProvider: null,
        cwd: null,
        approvalPolicy: null,
        sandbox: null,
        config: null,
        baseInstructions: null,
        developerInstructions: null,
      };
      await invoke<ThreadResumeResponse>('thread_resume', { params });

      set((state) => ({
        currentThreadId: threadId,
        isProcessing: false,
        activeThreadIds: state.activeThreadIds.includes(threadId)
          ? state.activeThreadIds
          : [...state.activeThreadIds, threadId],
        events: state.events[threadId] ? state.events : { ...state.events, [threadId]: [] },
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to resume thread', isProcessing: false });
      throw error;
    }
  },

  turnStart: async (threadId: string, input: string) => {
    try {
      set({ error: null, isProcessing: true });

      // Add user message to events immediately
      get().addEvent(threadId, {
        method: 'user_input',
        params: { text: input }
      });

      const userInput: UserInput = { type: 'text', text: input };
      const params: TurnStartParams = {
        threadId,
        input: [userInput],
        cwd: null,
        approvalPolicy: null,
        sandboxPolicy: null,
        model: null,
        effort: null,
        summary: null,
      };
      const response = await invoke<TurnStartResponse>('turn_start', { params });
      const turn = response.turn;

      set({
        currentTurnId: turn.id
      });

      return turn;
    } catch (error: any) {
      set({ error: error.message || 'Failed to start turn', isProcessing: false });
      throw error;
    }
  },

  turnInterrupt: async (threadId: string, turnId: string) => {
    try {
      set({ error: null });
      const params: TurnInterruptParams = { threadId, turnId };
      await invoke('turn_interrupt', { params });

      set({ isProcessing: false, currentTurnId: null });
    } catch (error: any) {
      set({ error: error.message || 'Failed to interrupt turn' });
      throw error;
    }
  },

  setCurrentThread: async (threadId: string | null) => {
    if (!threadId) {
      set({ currentThreadId: null, currentTurnId: null, isProcessing: false });
      return;
    }

    const state = get();

    // If thread is not active, resume it first
    if (!state.activeThreadIds.includes(threadId)) {
      await get().threadResume(threadId);
    } else {
      set({ currentThreadId: threadId, currentTurnId: null });
    }
  },

  setThreads: (threads: Thread[]) => {
    set({ threads });
  },

  addEvent: (threadId: string, event: ChatEvent) => {
    set((state) => {
      const newEvents = {
        ...state.events,
        [threadId]: [...(state.events[threadId] || []), event],
      };

      // Update isProcessing based on the latest event for current thread
      let isProcessing = state.isProcessing;
      if (threadId === state.currentThreadId) {
        const method = event.method;
        if (method === 'turn/completed' || method === 'error') {
          isProcessing = false;
        } else {
          isProcessing = true;
        }
        console.log(method, isProcessing)
      }

      return {
        events: newEvents,
        isProcessing,
      };
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));
