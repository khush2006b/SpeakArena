import { create } from "zustand";

export interface Notification {
  id: string;
  title: string;
  description: string;
  type: "payment" | "student" | "meeting" | "system" | "upload" | "message";
  priority: "critical" | "high" | "medium" | "low";
  timestamp: string;
  isRead: boolean;
  studentName?: string;
  studentAvatar?: string;
  courseName?: string;
  amount?: number;
}

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: "success" | "error" | "warning" | "info" | "loading";
  duration?: number;
}

interface NotificationsState {
  notifications: Notification[];
  activeNotificationId: string | null;
  isRightPanelOpen: boolean;
  unreadCount: number;
  toasts: Toast[];

  activeCategory: "payment" | "student" | "meeting" | "system" | "upload" | "message" | "all" | "unread" | "inbox" | "activity";
  searchQuery: string;

  setActiveCategory: (category: "payment" | "student" | "meeting" | "system" | "upload" | "message" | "all" | "unread" | "inbox" | "activity" | string) => void;
  setSearchQuery: (query: string) => void;

  setNotifications: (notifications: Notification[]) => void;
  setActiveNotificationId: (id: string | null) => void;
  setIsRightPanelOpen: (isOpen: boolean) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;

  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  activeNotificationId: null,
  isRightPanelOpen: false,
  unreadCount: 0,
  toasts: [],
  activeCategory: "all",
  searchQuery: "",

  setActiveCategory: (cat) => set({ activeCategory: cat as any }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  setNotifications: (notifications) => set({ 
    notifications,
    unreadCount: notifications.filter(n => !n.isRead).length
  }),
  
  setActiveNotificationId: (id) => set({ activeNotificationId: id }),
  setIsRightPanelOpen: (isOpen) => set({ isRightPanelOpen: isOpen }),
  
  markAsRead: (id) => set((state) => {
    const updated = state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
    return { 
      notifications: updated,
      unreadCount: updated.filter(n => !n.isRead).length
    };
  }),
  
  markAllAsRead: () => set((state) => {
    const updated = state.notifications.map(n => ({ ...n, isRead: true }));
    return {
      notifications: updated,
      unreadCount: 0
    };
  }),

  addToast: (toast) => set((state) => {
    const id = Math.random().toString(36).substring(2, 9);
    return { toasts: [...state.toasts, { ...toast, id }] };
  }),
  
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id),
  })),
}));
