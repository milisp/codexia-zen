import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CodexState {
  cwd: string | null;
  setCwd: (cwd: string | null) => void;
  clearCwd: () => void;
}

export const useCodexStore = create<CodexState>()(
  persist(
    (set) => ({
      cwd: null,
      setCwd: (cwd) => set({ cwd }),
      clearCwd: () => set({ cwd: null }),
    }),
    {
      name: "codex-meta",
    },
  ),
);
