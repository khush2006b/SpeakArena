import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewMode = "grid" | "list";

interface CoursesStoreState {
  viewMode: ViewMode;
  searchQuery: string;
  categoryFilter: string | null;
  selectedCourseId: string | null; // For the preview drawer
  
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (category: string | null) => void;
  setSelectedCourseId: (id: string | null) => void;
}

export const useCoursesStore = create<CoursesStoreState>()(
  persist(
    (set) => ({
      viewMode: "grid",
      searchQuery: "",
      categoryFilter: null,
      selectedCourseId: null,
      
      setViewMode: (mode) => set({ viewMode: mode }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setCategoryFilter: (category) => set({ categoryFilter: category }),
      setSelectedCourseId: (id) => set({ selectedCourseId: id }),
    }),
    {
      name: "courses-library-storage",
      partialize: (state) => ({ viewMode: state.viewMode }), // Only persist the view mode preference
    }
  )
);
