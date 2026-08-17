import { create } from "zustand";

export type RightSidebarTab = "notes" | "bookmarks" | "resources" | "discussion";

interface WorkspaceStoreState {
  isLeftSidebarOpen: boolean;
  isRightSidebarOpen: boolean;
  isFullscreen: boolean;
  activeRightTab: RightSidebarTab;
  
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  toggleFullscreen: () => void;
  setActiveRightTab: (tab: RightSidebarTab) => void;
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set) => ({
  isLeftSidebarOpen: true, // Default to curriculum visible
  isRightSidebarOpen: false, // Default to utility panel hidden to save space
  isFullscreen: false,
  activeRightTab: "notes",
  
  toggleLeftSidebar: () => set((state) => ({ isLeftSidebarOpen: !state.isLeftSidebarOpen })),
  toggleRightSidebar: () => set((state) => ({ isRightSidebarOpen: !state.isRightSidebarOpen })),
  
  toggleFullscreen: () => set((state) => {
    const nextFullscreen = !state.isFullscreen;
    return { 
      isFullscreen: nextFullscreen,
      // Force collapse sidebars if entering fullscreen
      isLeftSidebarOpen: nextFullscreen ? false : state.isLeftSidebarOpen,
      isRightSidebarOpen: nextFullscreen ? false : state.isRightSidebarOpen
    };
  }),
  
  setActiveRightTab: (tab) => set({ activeRightTab: tab, isRightSidebarOpen: true }),
}));
