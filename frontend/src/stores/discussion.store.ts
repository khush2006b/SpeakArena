import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DiscussionFilter, DiscussionCategory } from "../features/student/constants/discussion.mock";

export type ViewMode = "feed" | "thread";

interface DiscussionState {
  // Navigation
  activeView: ViewMode;
  activeThreadId: string | null;
  
  // Filtering
  searchQuery: string;
  activeFilter: DiscussionFilter;
  activeCategory: DiscussionCategory | "all";
  selectedTags: string[];
  
  // Layout
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;
  
  // Actions
  setActiveView: (view: ViewMode) => void;
  setActiveThreadId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: DiscussionFilter) => void;
  setActiveCategory: (category: DiscussionCategory | "all") => void;
  toggleTag: (tag: string) => void;
  
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  
  openThread: (id: string) => void;
  closeThread: () => void;
}

export const useDiscussionStore = create<DiscussionState>()(
  persist(
    (set) => ({
      activeView: "feed",
      activeThreadId: null,
      
      searchQuery: "",
      activeFilter: "all",
      activeCategory: "all",
      selectedTags: [],
      
      isLeftPanelOpen: true,
      isRightPanelOpen: true, // Default open on desktop
      
      setActiveView: (view) => set({ activeView: view }),
      setActiveThreadId: (id) => set({ activeThreadId: id }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setActiveFilter: (filter) => set({ activeFilter: filter }),
      setActiveCategory: (category) => set({ activeCategory: category }),
      toggleTag: (tag) => set((state) => ({
        selectedTags: state.selectedTags.includes(tag) 
          ? state.selectedTags.filter(t => t !== tag)
          : [...state.selectedTags, tag]
      })),
      
      toggleLeftPanel: () => set((state) => ({ isLeftPanelOpen: !state.isLeftPanelOpen })),
      toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
      
      openThread: (id) => set({ activeView: "thread", activeThreadId: id }),
      closeThread: () => set({ activeView: "feed", activeThreadId: null }),
    }),
    {
      name: "speakarena-discussion-storage",
      partialize: (state) => ({ 
        isLeftPanelOpen: state.isLeftPanelOpen,
        isRightPanelOpen: state.isRightPanelOpen,
        activeFilter: state.activeFilter,
        activeCategory: state.activeCategory
      }),
    }
  )
);
