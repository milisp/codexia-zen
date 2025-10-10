
import { create } from "zustand";

type SessionState = {
  sessionId: string | null;
  isSessionActive: boolean;
  isInitializing: boolean;
  error: string | null;
};

type SessionActions = {
  setSessionId: (id: string | null) => void;
  setSessionActive: (isActive: boolean) => void;
  setIsInitializing: (isInitializing: boolean) => void;
  setError: (error: string | null) => void;
};

export const useSessionStore = create<SessionState & SessionActions>()((set) => ({
  sessionId: null,
  isSessionActive: false,
  isInitializing: false,
  error: null,

  setSessionId: (id) => set({ sessionId: id }),
  setSessionActive: (isActive) =>
    set({ isSessionActive: isActive, isInitializing: false }),
  setIsInitializing: (isInitializing) => set({ isInitializing }),
  setError: (error) => set({ error }),
}));
