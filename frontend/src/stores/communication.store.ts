import { create } from "zustand";
import { apiClient } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";

export type ChannelType = "course" | "live" | "announcement" | "direct";
export type MessageRole = "teacher" | "student" | "system";

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  unreadCount: number;
  isPrivate?: boolean;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  status: "online" | "idle" | "offline";
  role: MessageRole;
}

export interface Message {
  id: string;
  channelId: string;
  user: User | null;
  content: string;
  timestamp: string;
  isPinned?: boolean;
  isAnnouncement?: boolean;
  type: "text" | "system" | "file";
  attachments?: {
    name: string;
    url: string;
    type: "image" | "pdf" | "document";
  }[];
}

export interface CommunicationState {
  // ── Channel / room state ──────────────────────────────────────────
  activeChannelId: string;
  channels: Channel[];
  channelsLoading: boolean;

  // ── Message state ─────────────────────────────────────────────────
  messages: Message[];
  messagesLoading: boolean;
  isSending: boolean;

  // ── UI state ──────────────────────────────────────────────────────
  isRightPanelOpen: boolean;
  replyingToId: string | null;
  moderationMode: boolean;

  // ── Actions ───────────────────────────────────────────────────────
  setActiveChannelId: (id: string) => void;
  toggleRightPanel: () => void;
  setReplyingToId: (id: string | null) => void;
  setModerationMode: (enabled: boolean) => void;

  /** Fetch course-based channels from teacher courses API */
  fetchChannels: () => Promise<void>;

  /** Fetch messages for the active channel via REST */
  fetchMessages: (channelId: string) => Promise<void>;

  /** Send a message to the active channel */
  sendMessage: (content: string, replyToId?: string | null) => Promise<void>;
}

// ── Fallback channels used when API is offline ────────────────────────────────
const FALLBACK_CHANNELS: Channel[] = [
  { id: "chan-ann", name: "Announcements", type: "announcement", unreadCount: 0 },
  { id: "chan-1",   name: "Spoken English & Accent Reduction", type: "course", unreadCount: 3 },
  { id: "chan-2",   name: "Executive Business Communication",  type: "course", unreadCount: 0 },
];

export const useCommunicationStore = create<CommunicationState>((set, get) => ({
  activeChannelId: "chan-1",
  channels: FALLBACK_CHANNELS,
  channelsLoading: false,
  messages: [],
  messagesLoading: false,
  isSending: false,
  isRightPanelOpen: true,
  replyingToId: null,
  moderationMode: false,

  setActiveChannelId: (id) => {
    set({ activeChannelId: id, messages: [] });
    get().fetchMessages(id);
  },
  toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
  setReplyingToId: (id) => set({ replyingToId: id }),
  setModerationMode: (enabled) => set({ moderationMode: enabled }),

  // ── fetchChannels ─────────────────────────────────────────────────────────
  fetchChannels: async () => {
    set({ channelsLoading: true });
    try {
      const res = await apiClient.get("/api/v1/teacher/courses?page=1&page_size=20");
      const raw = res.data;
      const courses: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw?.data)
        ? raw.data
        : [];

      const courseChannels: Channel[] = courses.map((c: any) => ({
        id: c.id,
        name: c.title,
        type: "course" as const,
        unreadCount: 0,
      }));

      const channels: Channel[] = [
        { id: "chan-ann", name: "Announcements", type: "announcement", unreadCount: 0 },
        ...courseChannels,
      ];

      set({ channels, channelsLoading: false });
      // Set first channel as active if default doesn't exist
      const { activeChannelId } = get();
      const exists = channels.find((c) => c.id === activeChannelId);
      if (!exists && channels.length > 0) {
        set({ activeChannelId: channels[0].id });
        get().fetchMessages(channels[0].id);
      } else if (exists) {
        get().fetchMessages(activeChannelId);
      }
    } catch {
      // Keep fallback channels visible — do not show blank state
      set({ channelsLoading: false });
    }
  },

  // ── fetchMessages ─────────────────────────────────────────────────────────
  fetchMessages: async (channelId: string) => {
    set({ messagesLoading: true });
    try {
      const res = await apiClient.get(ENDPOINTS.CHAT.MESSAGES(channelId));
      const raw = res.data;
      const items: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw?.data)
        ? raw.data
        : [];

      const messages: Message[] = items.map((m: any) => ({
        id: m.id,
        channelId,
        user: m.sender
          ? {
              id: m.sender.id,
              name: m.sender.full_name ?? m.sender.name ?? "User",
              avatar: m.sender.avatar_url ?? m.sender.avatar ?? "",
              status: "online" as const,
              role: (m.sender.role === "teacher" ? "teacher" : "student") as MessageRole,
            }
          : null,
        content: m.content ?? m.body ?? "",
        timestamp: m.created_at ?? m.timestamp ?? new Date().toISOString(),
        type: (m.type === "system" ? "system" : m.attachments?.length ? "file" : "text") as Message["type"],
        isPinned: m.is_pinned ?? false,
        attachments: m.attachments,
      }));

      set({ messages, messagesLoading: false });
    } catch {
      // Show empty messages gracefully — don't crash
      set({ messages: [], messagesLoading: false });
    }
  },

  // ── sendMessage ───────────────────────────────────────────────────────────
  sendMessage: async (content: string, replyToId?: string | null) => {
    const { activeChannelId, messages } = get();
    set({ isSending: true });

    // Optimistic UI update
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      channelId: activeChannelId,
      user: null, // Will be replaced on success
      content,
      timestamp: new Date().toISOString(),
      type: "text",
    };
    set({ messages: [...messages, tempMsg], replyingToId: null });

    try {
      const res = await apiClient.post(ENDPOINTS.CHAT.MESSAGES(activeChannelId), {
        content,
        ...(replyToId ? { reply_to_id: replyToId } : {}),
      });
      const sent = res.data?.data ?? res.data;

      // Replace temp message with confirmed one
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === tempMsg.id
            ? {
                ...m,
                id: sent?.id ?? m.id,
                user: sent?.sender
                  ? {
                      id: sent.sender.id,
                      name: sent.sender.full_name ?? "You",
                      avatar: sent.sender.avatar_url ?? "",
                      status: "online" as const,
                      role: "teacher" as MessageRole,
                    }
                  : null,
              }
            : m
        ),
        isSending: false,
      }));
    } catch {
      // Remove temp message on failure
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== tempMsg.id),
        isSending: false,
      }));
    }
  },
}));
