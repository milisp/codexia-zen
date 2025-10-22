import { create } from "zustand";

type SessionState = {
  isSessionActive: boolean;
  isInitializing: boolean;
  error: string | null;
};

type SessionActions = {
  setSessionActive: (isActive: boolean) => void;
  setIsInitializing: (isInitializing: boolean) => void;
  setError: (error: string | null) => void;
};

export const useSessionStore = create<SessionState & SessionActions>()(
  (set) => ({
    isSessionActive: false,
    isInitializing: false,
    error: null,

    setSessionActive: (isActive) =>
      set({ isSessionActive: isActive, isInitializing: false }),
    setIsInitializing: (isInitializing) => set({ isInitializing }),
    setError: (error) => set({ error }),
  }),
);
