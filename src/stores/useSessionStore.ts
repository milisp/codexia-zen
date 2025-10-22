import { create } from "zustand";

interface SessionState {
  isInitializing: boolean;
  isSending: boolean;
}

interface SessionActions {
  setIsInitializing: (value: boolean) => void;
  setIsSending: (value: boolean) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionState & SessionActions>()(
  (set) => ({
    isInitializing: false,
    isSending: false,
    setIsInitializing: (value) => set({ isInitializing: value }),
    setIsSending: (value) => set({ isSending: value }),
    reset: () => set({ isInitializing: false, isSending: false }),
  }),
);
