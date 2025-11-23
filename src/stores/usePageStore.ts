import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PageState {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

export const usePageStore = create<PageState>()(
  persist(
    (set) => ({
      currentPage: "/", // Default page
      setCurrentPage: (page) => set({ currentPage: page }),
    }),
    {
      name: "page-storage", // unique name
    },
  ),
);