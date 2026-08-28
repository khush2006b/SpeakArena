/**
 * Real-time chat Zustand store.
 *
 * Manages optimistic messages, typing indicators, connection status,
 * and pinned messages for the live course chat feature.
 *
 * Optimistic message flow:
 *   1. User sends → addOptimisticMessage (instant UI)
 *   2. WS confirms → confirmMessage (replaces temp with real)
 *   3. WS error → markMessageFailed (shows retry button)
 */

import { create } from "zustand";
import type { ChatMessage, TypingUser } from "@/types";

export type WSConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface OptimisticMessage extends Omit<ChatMessage, "id" | "createdAt" | "updatedAt"> {
  tempId: string;
  isOptimistic: true;
  isFailed: boolean;
}

interface ChatState {
  activeRoomId: string | null;
  connectionStatus: WSConnectionStatus;
  optimisticMessages: OptimisticMessage[];
  typingUsers: TypingUser[];
  hasUnread: boolean;
}

interface ChatActions {
  setActiveRoom: (roomId: string) => void;
  clearActiveRoom: () => void;
  setConnectionStatus: (status: WSConnectionStatus) => void;
  addOptimisticMessage: (message: Omit<OptimisticMessage, "isOptimistic" | "isFailed">) => void;
  confirmMessage: (tempId: string) => void;
  markMessageFailed: (tempId: string) => void;
  removeOptimisticMessage: (tempId: string) => void;
  setTypingUsers: (users: TypingUser[]) => void;
  addTypingUser: (user: TypingUser) => void;
  removeTypingUser: (userId: string) => void;
  setHasUnread: (hasUnread: boolean) => void;
  clearUnread: () => void;
}

type ChatStore = ChatState & ChatActions;

export const useChatStore = create<ChatStore>()((set) => ({
  activeRoomId: null,
  connectionStatus: "idle",
  optimisticMessages: [],
  typingUsers: [],
  hasUnread: false,

  setActiveRoom: (roomId) => set({ activeRoomId: roomId }),
  clearActiveRoom: () => set({ activeRoomId: null, connectionStatus: "idle", optimisticMessages: [], typingUsers: [] }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setHasUnread: (hasUnread) => set({ hasUnread }),
  clearUnread: () => set({ hasUnread: false }),

  addOptimisticMessage: (message) =>
    set((s) => ({
      optimisticMessages: [
        ...s.optimisticMessages,
        { ...message, isOptimistic: true, isFailed: false },
      ],
    })),

  confirmMessage: (tempId) =>
    set((s) => ({
      optimisticMessages: s.optimisticMessages.filter((m) => m.tempId !== tempId),
    })),

  markMessageFailed: (tempId) =>
    set((s) => ({
      optimisticMessages: s.optimisticMessages.map((m) =>
        m.tempId === tempId ? { ...m, isFailed: true } : m,
      ),
    })),

  removeOptimisticMessage: (tempId) =>
    set((s) => ({
      optimisticMessages: s.optimisticMessages.filter((m) => m.tempId !== tempId),
    })),

  setTypingUsers: (users) => set({ typingUsers: users }),
  addTypingUser: (user) =>
    set((s) => ({
      typingUsers: s.typingUsers.some((u) => u.userId === user.userId)
        ? s.typingUsers
        : [...s.typingUsers, user],
    })),
  removeTypingUser: (userId) =>
    set((s) => ({
      typingUsers: s.typingUsers.filter((u) => u.userId !== userId),
    })),
}));
