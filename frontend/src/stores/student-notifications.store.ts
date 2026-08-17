import { create } from "zustand";

export type ViewMode = "inbox" | "timeline" | "settings";

interface StudentNotificationsState {
  viewMode: ViewMode;
  searchQuery: string;
  activeCategory: string;
  selectedNotificationId: string | null;
  notifications: any[];
  
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  setActiveCategory: (category: string) => void;
  setSelectedNotificationId: (id: string | null) => void;
  setNotifications: (notifications: any[]) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  archiveNotification: (id: string) => void;
}

export const useStudentNotificationsStore = create<StudentNotificationsState>((set) => ({
  viewMode: "inbox",
  searchQuery: "",
  activeCategory: "all",
  selectedNotificationId: null,
  notifications: [],
  
  setViewMode: (mode) => set({ viewMode: mode, selectedNotificationId: null }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveCategory: (category) => set({ activeCategory: category, selectedNotificationId: null }),
  setSelectedNotificationId: (id) => set({ selectedNotificationId: id }),
  setNotifications: (notifications) => set({ notifications }),
  
  markAsRead: (id) => set((state) => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n)
  })),
  
  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, isRead: true }))
  })),
  
  archiveNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id),
    selectedNotificationId: state.selectedNotificationId === id ? null : state.selectedNotificationId
  })),
}));
