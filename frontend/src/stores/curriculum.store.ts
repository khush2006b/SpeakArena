import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LessonFilter = "all" | "incomplete" | "completed" | "bookmarked" | "downloaded" | "live" | "resources";

interface CurriculumState {
  searchQuery: string;
  activeFilter: LessonFilter;
  expandedModules: Record<string, boolean>;
  
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: LessonFilter) => void;
  toggleModule: (moduleId: string) => void;
  setModuleExpanded: (moduleId: string, expanded: boolean) => void;
  expandAll: (moduleIds: string[]) => void;
  collapseAll: () => void;
}

export const useCurriculumStore = create<CurriculumState>()(
  persist(
    (set) => ({
      searchQuery: "",
      activeFilter: "all",
      expandedModules: {},
      
      setSearchQuery: (query) => set({ searchQuery: query }),
      setActiveFilter: (filter) => set({ activeFilter: filter }),
      
      toggleModule: (moduleId) => set((state) => ({
        expandedModules: {
          ...state.expandedModules,
          [moduleId]: !state.expandedModules[moduleId]
        }
      })),
      
      setModuleExpanded: (moduleId, expanded) => set((state) => ({
        expandedModules: {
          ...state.expandedModules,
          [moduleId]: expanded
        }
      })),
      
      expandAll: (moduleIds) => set(() => {
        const expanded: Record<string, boolean> = {};
        moduleIds.forEach(id => expanded[id] = true);
        return { expandedModules: expanded };
      }),
      
      collapseAll: () => set({ expandedModules: {} }),
    }),
    {
      name: "speakarena-curriculum-storage",
      partialize: (state) => ({ 
        expandedModules: state.expandedModules,
        activeFilter: state.activeFilter 
      }),
    }
  )
);
