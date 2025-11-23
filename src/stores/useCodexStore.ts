import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CodexState {
  cwd: string | null;
  isInitializing: boolean;
  isSending: boolean;
}

interface CodexActions {
  setCwd: (cwd: string | null) => void;
  setIsInitializing: (value: boolean) => void;
  setIsSending: (value: boolean) => void;
  resetSession: () => void;
}

export const useCodexStore = create<CodexState & CodexActions>()(
  persist(
    (set) => ({
      cwd: null,
      isInitializing: false,
      isSending: false,
      setCwd: (cwd) => set({ cwd }),
      setIsInitializing: (value) => set({ isInitializing: value }),
      setIsSending: (value) => set({ isSending: value }),
      resetSession: () => set({ isInitializing: false, isSending: false }),
    }),
    {
      name: "codex-meta",
    },
  ),
);
