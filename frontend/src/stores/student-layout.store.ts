import { create } from "zustand";

interface StudentLayoutState {
  isSidebarExpanded: boolean;
  isSearchOpen: boolean;
  isQuickActionBarVisible: boolean;
  
  toggleSidebar: () => void;
  setSidebarExpanded: (expanded: boolean) => void;
  
  toggleSearch: () => void;
  setSearchOpen: (open: boolean) => void;
  
  setQuickActionBarVisible: (visible: boolean) => void;
}

export const useStudentLayoutStore = create<StudentLayoutState>((set) => ({
  isSidebarExpanded: false, // Default to collapsed for immersive experience
  isSearchOpen: false,
  isQuickActionBarVisible: true,
  
  toggleSidebar: () => set((state) => ({ isSidebarExpanded: !state.isSidebarExpanded })),
  setSidebarExpanded: (expanded) => set({ isSidebarExpanded: expanded }),
  
  toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),
  setSearchOpen: (open) => set({ isSearchOpen: open }),
  
  setQuickActionBarVisible: (visible) => set({ isQuickActionBarVisible: visible }),
}));
