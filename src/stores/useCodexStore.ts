import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface CodexStore {
  cwd: string | null;
  setCwd: (cwd: string) => void;
}

export const useCodex = create<CodexStore>()(
  persist(
    (set) => ({
      cwd: null,
      setCwd: (cwd) => set({ cwd }),
    }),
    {
      name: 'codex-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
