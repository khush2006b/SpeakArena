import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Resource } from "@/features/student/constants/resources.mock";

export type ViewMode = "grid" | "list" | "compact";

interface ResourcesState {
  viewMode: ViewMode;
  searchQuery: string;
  activeFilter: string;
  selectedResource: Resource | null;
  
  // Actions
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: string) => void;
  setSelectedResource: (resource: Resource | null) => void;
}

export const useResourcesStore = create<ResourcesState>()(
  persist(
    (set) => ({
      viewMode: "grid", // default
      searchQuery: "",
      activeFilter: "all",
      selectedResource: null,
      
      setViewMode: (mode) => set({ viewMode: mode }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setActiveFilter: (filter) => set({ activeFilter: filter }),
      setSelectedResource: (resource) => set({ selectedResource: resource }),
    }),
    {
      name: "speakarena-resources-storage",
      partialize: (state) => ({ viewMode: state.viewMode }), // Only persist viewMode
    }
  )
);
