import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CodexStore {
  cwd: string | null;
  setCwd: (cwd: string) => void;
}

export const useCodexStore = create<CodexStore>()(
  persist(
    (set) => ({
      cwd: null,
      setCwd: (cwd) => set({ cwd }),
    }),
    {
      name: "codex"
    },
  ),
);
