import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface UIState {
  isSidebarCollapsed: boolean;
  isSearchOpen: boolean;
  isNotificationDrawerOpen: boolean;
  courseViewType: "grid" | "list";
  
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  toggleSearch: () => void;
  setSearchOpen: (open: boolean) => void;
  
  toggleNotificationDrawer: () => void;
  setNotificationDrawerOpen: (open: boolean) => void;

  setCourseViewType: (view: "grid" | "list") => void;

  courseSearch: string;
  courseStatusFilter: string;
  setCourseSearch: (search: string) => void;
  setCourseStatusFilter: (status: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      isSearchOpen: false,
      isNotificationDrawerOpen: false,
      courseViewType: "grid",

      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),

      toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),
      setSearchOpen: (open) => set({ isSearchOpen: open }),

      toggleNotificationDrawer: () => set((state) => ({ isNotificationDrawerOpen: !state.isNotificationDrawerOpen })),
      setNotificationDrawerOpen: (open) => set({ isNotificationDrawerOpen: open }),

      setCourseViewType: (view) => set({ courseViewType: view }),

      courseSearch: "",
      courseStatusFilter: "all",
      setCourseSearch: (search) => set({ courseSearch: search }),
      setCourseStatusFilter: (status) => set({ courseStatusFilter: status }),
    }),
    {
      name: "speakarena-ui-storage",
      storage: createJSONStorage(() => localStorage),
      // Persist sidebar and course view preference. Modals should reset on refresh.
      partialize: (state) => ({ 
        isSidebarCollapsed: state.isSidebarCollapsed,
        courseViewType: state.courseViewType 
      }),
    }
  )
);
