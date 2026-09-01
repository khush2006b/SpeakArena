"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  MessageSquare,
  Send,
  Loader2,
  AlertCircle,
  BookOpen,
  Megaphone,
  UserCheck,
  Lock,
  Hash,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Sparkles,
  Circle,
  Info,
  ArrowLeft,
  X,
  ExternalLink,
  Download,
  Image as ImageIcon,
} from "lucide-react";
import { apiClient } from "@/services/api/client";
import { useAuthStore } from "@/stores/auth.store";
import { useChatStore } from "@/stores/chat.store";
import {
  connectChatSocket,
  disconnectChatSocket,
  getChatSocket,
  sendTypingStart,
  sendTypingStop,
  socketEvents,
} from "@/services/socket.client";
import type { Course } from "@/types";
import { toast } from "sonner";

function getCourseTeacherId(course: any): string {
  if (!course) return "";
  const id =
    course.teacher_id ||
    course.teacherId ||
    course.teacher?.id ||
    course.teacher_info?.id ||
    course.instructor_id ||
    course.instructorId ||
    course.created_by ||
    course.createdBy ||
    course.user_id;
  return id ? String(id) : "";
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatRoom {
  id: string;
  course_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface BackendMessage {
  id: string;
  chat_room_id: string;
  sender: {
    id: string;
    full_name: string;
    avatar_r2_key: string | null;
    role: string;
  };
  recipient_id?: string | null;
  content: string;
  content_type: string;
  reply_to: null | object;
  is_pinned: boolean;
  is_announcement: boolean;
  is_edited: boolean;
  is_deleted: boolean;
  attachments?: any[];
  created_at: string;
  reactions: Record<string, string[]>;
}

// The active "channel" can be:
// - "announcements"          → read-only broadcast for the selected course
// - "course:{id}"            → group discussion for a specific enrolled course
// - "teacher_dm:{courseId}"  → private 1-on-1 DM with that course's instructor
type ActiveChannel =
  | { type: "announcements"; course: Course }
  | { type: "course_announcements"; course: Course }
  | { type: "course"; course: Course }
  | { type: "teacher_dm"; course: Course };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getInitials(name?: string | null) {
  if (!name || typeof name !== "string") return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Avatar({
  name,
  size = 34,
  gradient = "linear-gradient(135deg,#4f46e5,#7c3aed)",
  image,
}: {
  name?: string | null;
  size?: number;
  gradient?: string;
  image?: string;
}) {
  if (image) {
    return (
      <img
        src={image}
        alt={name || "Avatar"}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: gradient,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.34,
        fontWeight: 700,
        color: "#fff",
        flexShrink: 0,
        letterSpacing: "-0.5px",
      }}
    >
      {getInitials(name)}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function StudentMessagesView() {
  const user = useAuthStore((s) => s.user);
  const {
    connectionStatus,
    setConnectionStatus,
    setActiveRoom,
    clearActiveRoom,
    typingUsers,
    unreadChannelKeys,
    markChannelRead,
  } = useChatStore();

  // ── State Hooks ──────────────────────────────────────────────────────────────
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  const [activeChannel, setActiveChannel] = useState<ActiveChannel | null>(null);
  const [coursesSectionOpen, setCoursesSectionOpen] = useState(true);
  const [dmsSectionOpen, setDmsSectionOpen] = useState(true);

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  const [messages, setMessages] = useState<BackendMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  // ── Photo Attachments ────────────────────────────────────────────────────────
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newPhotos = [...selectedPhotos, ...files].slice(0, 5);
    setSelectedPhotos(newPhotos);
    const newPreviews = newPhotos.map((f) => URL.createObjectURL(f));
    setPhotoPreviews(newPreviews);
  };

  const removePhoto = (index: number) => {
    const updatedPhotos = selectedPhotos.filter((_, i) => i !== index);
    setSelectedPhotos(updatedPhotos);
    const updatedPreviews = photoPreviews.filter((_, i) => i !== index);
    setPhotoPreviews(updatedPreviews);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items || []);
    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      const newPhotos = [...selectedPhotos, ...imageFiles].slice(0, 5);
      setSelectedPhotos(newPhotos);
      const newPreviews = newPhotos.map((f) => URL.createObjectURL(f));
      setPhotoPreviews(newPreviews);
      toast.info(`Pasted ${imageFiles.length} photo(s)`);
    }
  };

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const firstUnreadRef = useRef<HTMLDivElement>(null);
  const activeChannelRef = useRef<ActiveChannel | null>(null);
  const roomRef = useRef<ChatRoom | null>(null);
  const userIdRef = useRef<string>("");
  const coursesRef = useRef<Course[]>([]);

  useEffect(() => { activeChannelRef.current = activeChannel; }, [activeChannel]);
  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { userIdRef.current = user?.id ?? ""; }, [user?.id]);
  useEffect(() => { coursesRef.current = courses; }, [courses]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const openChannel = useCallback(
    (channel: ActiveChannel) => {
      setFirstUnreadMessageId(null);
      setActiveChannel(channel);
      setMobileShowChat(true);
    },
    []
  );

  // ── Fetch enrolled courses ────────────────────────────────────────────────────
  useEffect(() => {
    setCoursesLoading(true);
    apiClient
      .get("/api/v1/courses")
      .then((res) => {
        const raw = res.data;
        // API: { success, data: [...enrollments], pagination }
        // Each item is a flat enrollment+course object (no nested .course)
        let list: any[] = [];
        if (Array.isArray(raw?.data))        list = raw.data;
        else if (Array.isArray(raw?.data?.items)) list = raw.data.items;
        else if (Array.isArray(raw))         list = raw;
        else if (Array.isArray(raw?.courses)) list = raw.courses;

        const parsed: Course[] = list.map((item: any, idx: number) => {
          // item shape: { course_id, title, teacher_id, teacher_name, slug, ... }
          const cid = item.course_id || item.id || `c-${idx}`;
          return {
            ...item,
            id: cid,                                             // normalise to .id
            teacherName: item.teacher_name || item.teacherName || "Paras (Construction)",
            teacher_id:  item.teacher_id  || item.teacherId,
          } as Course & { teacher_id: string; teacherName: string };
        });

        setCourses(parsed);
        // Auto-select the first course's discussion channel
        if (parsed.length > 0) {
          setActiveChannel({ type: "course", course: parsed[0] });
        }
        setCoursesError(null);
      })
      .catch(() => setCoursesError("Failed to load courses."))
      .finally(() => setCoursesLoading(false));
  }, []);

  // ── Fetch Chat Room & Message History in Parallel ────────────────────────────
  const activeCourse = activeChannel?.course ?? null;

  useEffect(() => {
    if (!activeCourse || !activeChannel) return;
    const courseId = activeCourse.id;
    if (!courseId) return;

    let isMounted = true;
    setRoomLoading(true);
    setRoomError(null);
    setMessagesLoading(true);

    const roomType =
      activeChannel.type === "announcements"
        ? "global_announcement"
        : activeChannel.type === "course_announcements"
        ? "announcement"
        : "general";

    // 1. Parallel Request A: Fetch Chat Room metadata
    apiClient
      .get(`/api/v1/chat/${courseId}?room_type=${roomType}`)
      .then((res) => {
        if (!isMounted) return;
        const r: ChatRoom = res.data?.data;
        if (r) {
          setRoom(r);
          setActiveRoom(r.id);
        }
      })
      .catch(() => {
        if (isMounted) setRoomError("Chat room unavailable or you are not enrolled.");
      })
      .finally(() => {
        if (isMounted) setRoomLoading(false);
      });

    // 2. Parallel Request B: Fetch Messages history
    let messagesPromise: Promise<BackendMessage[]>;

    if (activeChannel.type === "announcements") {
      // General Announcements: collect global_announcement messages across all student courses
      const validCourses = courses.filter((c) => Boolean(c?.id));
      const targetCourses = validCourses.length > 0 ? validCourses : [activeCourse];
      messagesPromise = Promise.all(
        targetCourses.map((c) =>
          apiClient
            .get(`/api/v1/chat/${c.id}/messages?limit=50&room_type=global_announcement&announcements_only=true`)
            .then((res) => (res.data?.data?.messages ?? []) as BackendMessage[])
            .catch(() => [])
        )
      ).then((results) => {
        const all = results.flat().filter((m) => m.is_announcement);
        const seen = new Set<string>();
        const unique = all.filter((m) => {
          if (seen.has(m.id)) return false;
          const senderId = m.sender?.id || (m as any).sender_id || "";
          const timeKey = Math.floor(new Date(m.created_at).getTime() / 60000);
          const contentKey = `${m.content?.trim()}__${senderId}__${timeKey}`;
          if (seen.has(contentKey)) return false;
          seen.add(m.id);
          seen.add(contentKey);
          return true;
        });
        unique.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return unique;
      });
    } else if (activeChannel.type === "course_announcements") {
      // Course-Specific Announcements: fetch ONLY announcement room messages for this specific course
      messagesPromise = apiClient
        .get(`/api/v1/chat/${courseId}/messages?limit=50&room_type=announcement&announcements_only=true`)
        .then((res) => {
          let msgs: BackendMessage[] = res.data?.data?.messages ?? [];
          return msgs.filter((m) => m.is_announcement).reverse();
        })
        .catch(() => []);
    } else if (activeChannel.type === "teacher_dm") {
      const teacherId = getCourseTeacherId(activeCourse);
      messagesPromise = apiClient
        .get(
          teacherId
            ? `/api/v1/chat/${activeCourse.id}/messages?limit=100&dm_student_id=${teacherId}`
            : `/api/v1/chat/${activeCourse.id}/messages?limit=100`
        )
        .then((res) => {
          let msgs: BackendMessage[] = res.data?.data?.messages ?? [];
          msgs = msgs.filter((m) => !m.is_announcement && Boolean(m.recipient_id));
          return [...msgs].reverse();
        })
        .catch(() => []);
    } else {
      messagesPromise = apiClient
        .get(`/api/v1/chat/${courseId}/messages?limit=50&room_type=general&public_only=true`)
        .then((res) => {
          let msgs: BackendMessage[] = res.data?.data?.messages ?? [];
          return msgs.filter((m) => !m.is_announcement && !m.recipient_id).reverse();
        })
        .catch(() => []);
    }

    messagesPromise
      .then((fetchedMsgs) => {
        if (isMounted) {
          setMessages(fetchedMsgs);

          let k = "";
          if (activeChannel.type === "announcements") {
            k = "announcements";
          } else if (activeChannel.type === "course_announcements") {
            k = `course_announcements:${activeCourse.id}`;
          } else if (activeChannel.type === "teacher_dm") {
            const tid = getCourseTeacherId(activeCourse);
            k = tid ? `teacher_dm:${tid}` : "";
          } else {
            k = `course:${activeCourse.id}`;
          }

          // Read previous last-read timestamp & ID before marking this channel read
          const rawTs = typeof window !== "undefined" && k ? localStorage.getItem(`sa_read_ts_${k}`) : null;
          const lastReadTs = rawTs ? Number(rawTs) : 0;
          const isValidTs = lastReadTs > 1577836800000; // valid timestamp after 2020
          const myId = String(userIdRef.current || "").toLowerCase();

          let firstUnread: BackendMessage | null = null;
          if (isValidTs && fetchedMsgs.length > 0) {
            for (let i = 0; i < fetchedMsgs.length; i++) {
              const m = fetchedMsgs[i];
              const senderId = String(m.sender?.id || (m as any).sender_id || "").toLowerCase();
              if (senderId && senderId !== myId) {
                const msgTs = new Date(m.created_at).getTime();
                if (msgTs > lastReadTs) {
                  firstUnread = m;
                  break;
                }
              }
            }
          }

          const targetUnreadId = firstUnread ? firstUnread.id : null;
          setFirstUnreadMessageId(targetUnreadId);

          const scrollToTarget = () => {
            const container = chatContainerRef.current;
            if (targetUnreadId) {
              const el = document.getElementById(`unread-marker-${targetUnreadId}`) || document.getElementById(`msg-${targetUnreadId}`);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "start" });
                return;
              }
            }
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
            messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
          };

          // Multi-stage scroll to ensure images & layout render without jumping to top or random spots
          requestAnimationFrame(scrollToTarget);
          setTimeout(scrollToTarget, 50);
          setTimeout(scrollToTarget, 150);
          setTimeout(scrollToTarget, 350);

          // Now mark channel as read in store, storage, and server
          if (k && fetchedMsgs.length > 0) {
            const latest = fetchedMsgs[fetchedMsgs.length - 1];
            markChannelRead(k);
            if (typeof window !== "undefined") {
              localStorage.setItem(`sa_read_ts_${k}`, String(Date.now()));
              if (latest?.id) localStorage.setItem(k, latest.id);
            }
            apiClient.post("/api/v1/chat/read", { 
              channel_key: k, 
              message_id: latest?.id,
              dm_user_id: activeChannel.type === "teacher_dm" ? getCourseTeacherId(activeCourse) : undefined
            }).catch(() => {});
          }
        }
      })
      .finally(() => {
        if (isMounted) setMessagesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeCourse?.id, activeChannel?.type, setActiveRoom]);

  // ── WebSocket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!room) return;
    setConnectionStatus("connecting");
    connectChatSocket(room.id);
    const socket = getChatSocket(room.id);

    const onConnected = () => setConnectionStatus("connected");

    const onMessageNew = (payload: any) => {
      const msg: BackendMessage = payload?.message || payload;
      if (!msg || !msg.content) return;

      const currentRoom = roomRef.current;
      const ch = activeChannelRef.current;
      const myId = userIdRef.current.toLowerCase();
      const senderId = String(msg.sender?.id || (msg as any).sender_id || "").toLowerCase();
      const recId = String(msg.recipient_id || "").toLowerCase();

      // Handle Direct Messages
      if (msg.recipient_id) {
        if (recId === myId || senderId === myId) {
          const teacherId = String((ch?.type === "teacher_dm" ? (ch.course as any)?.teacher_id || (ch.course as any)?.teacherId : "") || "").toLowerCase();
          if (ch?.type === "teacher_dm" && (senderId === teacherId || recId === teacherId || !teacherId)) {
            setMessages((prev) => {
              if (prev.some((m) => String(m.id).toLowerCase() === String(msg.id).toLowerCase()))
                return prev;
              const tempIdx = prev.findIndex(
                (m) => m.id.startsWith("temp-") && m.content === msg.content
              );
              if (tempIdx !== -1) {
                const updated = [...prev];
                updated[tempIdx] = msg;
                return updated;
              }
              return [...prev, msg];
            });
          } else if (recId === myId && senderId !== myId) {
            toast.info(`New DM from ${msg.sender?.full_name || "Instructor"}: ${msg.content.slice(0, 40)}`);
            useChatStore.getState().setChannelUnread(`teacher_dm:${senderId}`, true);
          }
          return;
        }
      }

      // Room guard and channel filter for course channels / announcements.
      if (!ch) return;

      if (msg.is_announcement) {
        const crsId = msg.course_id || (msg as any).courseId || (currentRoom?.course_id);
        const rType = (msg as any).room_type || currentRoom?.room_type;
        const isGlobal = rType === "global_announcement";

        if (isGlobal) {
          const isLookingAtGeneralAnn = ch.type === "announcements";
          if (!isLookingAtGeneralAnn) {
            useChatStore.getState().setChannelUnread("announcements", true);
            toast.info(`New Announcement: ${msg.content.slice(0, 40)}`);
            return;
          }
        } else {
          const isLookingAtCourseAnn =
            ch.type === "course_announcements" &&
            (!currentRoom?.id || !msg.chat_room_id || String(msg.chat_room_id).toLowerCase() === String(currentRoom.id).toLowerCase());

          if (!isLookingAtCourseAnn) {
            if (crsId) {
              useChatStore.getState().setChannelUnread(`course_announcements:${crsId}`, true);
            }
            toast.info(`New Course Announcement: ${msg.content.slice(0, 40)}`);
            return;
          }
        }
      } else if (!msg.recipient_id) {
        // General talk message
        const crsId = msg.course_id || (msg as any).courseId || (currentRoom?.course_id);
        const isLookingAtThisGen =
          ch.type === "course" &&
          (!currentRoom?.id || !msg.chat_room_id || String(msg.chat_room_id).toLowerCase() === String(currentRoom.id).toLowerCase());

        if (!isLookingAtThisGen) {
          if (crsId && senderId !== myId) {
            useChatStore.getState().setChannelUnread(`course:${crsId}`, true);
          }
          return;
        }
      }

      setMessages((prev) => {
        if (
          prev.some(
            (m) =>
              String(m.id).toLowerCase() === String(msg.id).toLowerCase()
          )
        )
          return prev;

        if (ch.type === "announcements") {
          const senderId = String(msg.sender?.id || (msg as any).sender_id || "").toLowerCase();
          const msgTime = new Date(msg.created_at).getTime();
          const isDup = prev.some((m) => {
            const mSenderId = String(m.sender?.id || (m as any).sender_id || "").toLowerCase();
            const mTime = new Date(m.created_at).getTime();
            const sameContent = m.content?.trim() === msg.content?.trim();
            const sameSender = mSenderId === senderId;
            const withinWindow = Math.abs(msgTime - mTime) < 60000;
            return sameContent && sameSender && withinWindow;
          });
          if (isDup) return prev;
        }

        const tempIdx = prev.findIndex(
          (m) => m.id.startsWith("temp-") && m.content === msg.content
        );
        if (tempIdx !== -1) {
          const updated = [...prev];
          updated[tempIdx] = msg;
          return updated;
        }
        return [...prev, msg];
      });

      // Auto-scroll down if user is already near bottom or sent this message
      const container = chatContainerRef.current;
      const isNearBottom = container
        ? container.scrollHeight - container.scrollTop - container.clientHeight < 180
        : true;
      if (isNearBottom || senderId === myId) {
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        });
      }
    };

    const onMessageEdited = (payload: any) => {
      const { message_id, content } = payload ?? {};
      if (!message_id) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message_id ? { ...m, content, is_edited: true } : m
        )
      );
    };
    const onMessageDeleted = (payload: any) => {
      const { message_id } = payload ?? {};
      if (!message_id) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message_id
            ? { ...m, content: "[Message deleted]", is_deleted: true }
            : m
        )
      );
    };

    socket.on("connected", onConnected);
    socket.on(socketEvents.chat.MESSAGE_RECEIVED, onMessageNew);
    socket.on("message.edited", onMessageEdited);
    socket.on("message.deleted", onMessageDeleted);

    return () => {
      socket.off("connected", onConnected);
      socket.off(socketEvents.chat.MESSAGE_RECEIVED, onMessageNew);
      socket.off("message.edited", onMessageEdited);
      socket.off("message.deleted", onMessageDeleted);
      disconnectChatSocket(room.id);
      clearActiveRoom();
      setConnectionStatus("idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, setConnectionStatus, clearActiveRoom]);

  // ── Layout Scroll Sync (ensures chat container is never stuck at top) ────────
  useEffect(() => {
    if (messagesLoading || messages.length === 0) return;

    const performSync = () => {
      const container = chatContainerRef.current;
      if (firstUnreadMessageId) {
        const el = document.getElementById(`unread-marker-${firstUnreadMessageId}`) || document.getElementById(`msg-${firstUnreadMessageId}`);
        if (el) {
          el.scrollIntoView({ behavior: "auto", block: "start" });
          return;
        }
      }
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    };

    performSync();
    const f1 = requestAnimationFrame(performSync);
    const t1 = setTimeout(performSync, 50);
    const t2 = setTimeout(performSync, 150);
    const t3 = setTimeout(performSync, 350);

    return () => {
      cancelAnimationFrame(f1);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [messagesLoading, activeChannel, firstUnreadMessageId, messages.length]);

  // ── Typing ────────────────────────────────────────────────────────────────────
  const handleTyping = useCallback(() => {
    if (!room || activeChannelRef.current?.type !== "course") return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTypingStart(room.id);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTypingStop(room.id);
    }, 2500);
  }, [room]);

  // ── Send ──────────────────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const content = draft.trim();
      const photosToUpload = [...selectedPhotos];
      if ((!content && photosToUpload.length === 0) || !room || !activeCourse || !activeChannel || sending) return;
      // Students cannot send announcements
      if (activeChannel.type === "announcements") return;

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      isTypingRef.current = false;
      if (activeChannel.type === "course") sendTypingStop(room.id);
      setSending(true);
      setDraft("");
      setSelectedPhotos([]);
      setPhotoPreviews([]);

      // Upload photos if any
      let uploadedAttachments: any[] = [];
      if (photosToUpload.length > 0) {
        for (const photo of photosToUpload) {
          const lowerName = photo.name.toLowerCase();
          const mimeType =
            photo.type ||
            (lowerName.endsWith(".png")
              ? "image/png"
              : lowerName.endsWith(".webp")
              ? "image/webp"
              : lowerName.endsWith(".gif")
              ? "image/gif"
              : lowerName.endsWith(".svg")
              ? "image/svg+xml"
              : "image/jpeg");

          try {
            const presignRes = await apiClient.post(
              `/api/v1/chat/${activeCourse.id}/attachments/presign`,
              {
                file_name: photo.name,
                content_type: mimeType,
                size_bytes: photo.size,
              }
            );
            const { upload_url, r2_key, content_type: confirmedType } = presignRes.data?.data || {};

            if (upload_url) {
              const uploadRes = await fetch(upload_url, {
                method: "PUT",
                headers: { "Content-Type": confirmedType || mimeType },
                body: photo,
              });
              if (!uploadRes.ok) {
                throw new Error(`R2 upload failed: ${uploadRes.status}`);
              }
            }

            const publicUrl = r2_key
              ? `https://pub-24a225d578474f4fb5b75f2a90813a11.r2.dev/${r2_key.replace(/^\//, "")}`
              : "";

            uploadedAttachments.push({
              r2_key: r2_key || `chat/photos/${Date.now()}_${photo.name}`,
              file_name: photo.name,
              mime_type: confirmedType || mimeType,
              size_bytes: photo.size,
              url: publicUrl,
            });
          } catch (err) {
            console.warn("Upload to R2 failed, fallback to local data URL:", err);
            const localUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(photo);
            });
            uploadedAttachments.push({
              r2_key: `chat/photos/${Date.now()}_${photo.name}`,
              file_name: photo.name,
              mime_type: mimeType,
              size_bytes: photo.size,
              url: localUrl,
            });
          }
        }
      }

      const contentType = uploadedAttachments.length > 0 ? "image" : "text";
      const finalContent = content || (uploadedAttachments.length > 0 ? "📷 [Photo]" : "");

      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const teacherId =
        (activeCourse as any)?.teacher_id ||
        (activeCourse as any)?.teacherId ||
        undefined;

      const tempMsg: BackendMessage = {
        id: tempId,
        chat_room_id: room.id,
        sender: {
          id: user?.id ?? "",
          full_name: (user as any)?.full_name || user?.fullName || "You",
          avatar_r2_key: null,
          role: (user as any)?.role || user?.role || "student",
        },
        recipient_id:
          activeChannel.type === "teacher_dm" ? teacherId : undefined,
        content: finalContent,
        content_type: contentType,
        attachments: uploadedAttachments,
        reply_to: null,
        is_pinned: false,
        is_announcement: false,
        is_edited: false,
        is_deleted: false,
        created_at: new Date().toISOString(),
        reactions: {},
      };

      setMessages((prev) => [...prev, tempMsg]);
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });

      try {
        const payload: any = {
          content: finalContent,
          content_type: contentType,
          attachments: uploadedAttachments,
        };
        if (activeChannel.type === "teacher_dm" && teacherId) {
          payload.recipient_id = teacherId;
        }

        const res = await apiClient.post(
          `/api/v1/chat/${activeCourse.id}/messages`,
          payload
        );
        const realMsg: BackendMessage = res.data?.data;

        if (realMsg) {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === tempId);
            if (idx !== -1) {
              const updated = [...prev];
              updated[idx] = realMsg;
              return updated;
            }
            if (
              prev.some(
                (m) =>
                  String(m.id).toLowerCase() ===
                  String(realMsg.id).toLowerCase()
              )
            )
              return prev;
            return [...prev, realMsg];
          });
          requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          });
        }
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setDraft(content);
      } finally {
        setSending(false);
      }
    },
    [draft, selectedPhotos, room, sending, user, activeCourse, activeChannel]
  );

  // ── Typing label ──────────────────────────────────────────────────────────────
  const typingLabel = useMemo(() => {
    const others = typingUsers.filter((u) => u.userId !== user?.id);
    if (!others.length) return null;
    if (others.length === 1) return `${others[0].userName} is typing...`;
    if (others.length === 2)
      return `${others[0].userName} and ${others[1].userName} are typing...`;
    return "Several people are typing...";
  }, [typingUsers, user?.id]);

  const statusDot = {
    idle: { color: "#64748b", label: "Idle" },
    connecting: { color: "#f59e0b", label: "Connecting..." },
    connected: { color: "#22c55e", label: "Live" },
    reconnecting: { color: "#f59e0b", label: "Reconnecting..." },
    disconnected: { color: "#ef4444", label: "Disconnected" },
  }[connectionStatus];

  const isReadOnly =
    activeChannel?.type === "announcements" ||
    activeChannel?.type === "course_announcements";
  const isTeacherDm = activeChannel?.type === "teacher_dm";

  // Channel header labels
  const channelTitle = !activeChannel
    ? "Classroom Hub"
    : activeChannel.type === "announcements"
    ? `📢 General Announcements`
    : activeChannel.type === "course_announcements"
    ? `📢 ${activeChannel.course.title} — Announcements`
    : activeChannel.type === "course"
    ? `# ${activeChannel.course.title}`
    : `✉️ ${(activeChannel.course as any).teacherName || "Instructor"}`;

  const channelSubtitle = !activeChannel
    ? "Select a channel from the sidebar"
    : activeChannel.type === "announcements"
    ? "Platform & global announcements — read-only for students"
    : activeChannel.type === "course_announcements"
    ? `Official announcements for ${activeChannel.course.title}`
    : activeChannel.type === "course"
    ? `Group discussion for ${activeChannel.course.title}`
    : `Private 1-on-1 with ${(activeChannel.course as any).teacherName || "your instructor"}`;

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        background: "#080c14",
        color: "#f1f5f9",
        overflow: "hidden",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .ch-item { transition: background 0.15s, color 0.15s; }
        .ch-item:hover { background: rgba(255,255,255,0.05) !important; }
        .msg-input:focus { outline:none; border-color:rgba(99,102,241,0.5) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
        .send-btn:hover:not(:disabled) { filter: brightness(1.1); transform: scale(1.03); }
        .send-btn:disabled { opacity:0.45; cursor:not-allowed; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
      `}</style>

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col shrink-0 overflow-y-auto bg-[#0b0f1a] border-r border-white/5"
        style={{
          display: isMobile && mobileShowChat ? "none" : "flex",
          width: isMobile ? "100%" : 320,
          minWidth: isMobile ? "100%" : 320,
          maxWidth: isMobile ? "100%" : 320,
        }}
      >
        {/* Branding */}
        <div
          style={{
            padding: "18px 16px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <GraduationCap style={{ width: 20, height: 20, color: "#fff" }} />
            </div>
            <div>
              <div
                style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}
              >
                SpeakArena
              </div>
              <div
                style={{ fontSize: 11, color: "#4f46e5", fontWeight: 600 }}
              >
                Student Hub
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 1: Announcements ──────────────────────────────────────── */}
        {/* One entry per enrolled course so students can see each course's announcements */}
        <div style={{ padding: "10px 8px 2px" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              padding: "4px 8px 6px",
            }}
          >
            General
          </div>

          {/* Show announcements for the first enrolled course (global broadcast) */}
          {courses.length > 0 ? (
            <button
              className="ch-item"
              onClick={() => {
                openChannel({ type: "announcements", course: courses[0] });
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 10px",
                borderRadius: 8,
                background:
                  activeChannel?.type === "announcements"
                    ? "rgba(245,158,11,0.1)"
                    : "transparent",
                border:
                  activeChannel?.type === "announcements"
                    ? "1px solid rgba(245,158,11,0.2)"
                    : "1px solid transparent",
                color:
                  activeChannel?.type === "announcements"
                    ? "#f59e0b"
                    : "#94a3b8",
                fontWeight:
                  activeChannel?.type === "announcements" ? 700 : 400,
                cursor: "pointer",
                fontSize: 13,
                textAlign: "left",
              }}
            >
              <Megaphone
                style={{
                  width: 16,
                  height: 16,
                  color:
                    activeChannel?.type === "announcements"
                      ? "#f59e0b"
                      : "#64748b",
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1 }}>Announcements</span>
              {Boolean(unreadChannelKeys["announcements"]) && (
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#ef4444",
                    flexShrink: 0,
                    marginRight: 6,
                  }}
                  className="animate-pulse"
                />
              )}
              <Lock
                style={{
                  width: 11,
                  height: 11,
                  color: "#64748b",
                  flexShrink: 0,
                }}
              />
            </button>
          ) : (
            <div
              style={{
                padding: "8px 10px",
                fontSize: 12,
                color: "#475569",
                fontStyle: "italic",
              }}
            >
              {coursesLoading ? "Loading..." : "Enroll in a course first."}
            </div>
          )}
        </div>

        {/* ── SECTION 2: Courses ────────────────────────────────────────────── */}
        <div style={{ padding: "12px 8px 2px" }}>
          <button
            onClick={() => setCoursesSectionOpen((v) => !v)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px 6px",
              color: "#64748b",
              fontWeight: 700,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              textAlign: "left",
            }}
          >
            {coursesSectionOpen ? (
              <ChevronDown style={{ width: 12, height: 12 }} />
            ) : (
              <ChevronRight style={{ width: 12, height: 12 }} />
            )}
            My Courses
            {courses.length > 0 && (
              <span
                style={{
                  marginLeft: "auto",
                  background: "rgba(99,102,241,0.2)",
                  color: "#818cf8",
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 8,
                }}
              >
                {courses.length}
              </span>
            )}
          </button>

          {coursesSectionOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {coursesLoading ? (
                <div
                  style={{
                    padding: "8px 10px",
                    fontSize: 12,
                    color: "#475569",
                    fontStyle: "italic",
                  }}
                >
                  Loading courses...
                </div>
              ) : coursesError ? (
                <div
                  style={{
                    padding: "8px 10px",
                    fontSize: 12,
                    color: "#ef4444",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <AlertCircle style={{ width: 12, height: 12 }} />
                  {coursesError}
                </div>
              ) : courses.length === 0 ? (
                <div
                  style={{
                    padding: "8px 10px",
                    fontSize: 12,
                    color: "#475569",
                    fontStyle: "italic",
                  }}
                >
                  No enrolled courses.
                </div>
              ) : (
                courses.map((course) => {
                  const isAnnActive =
                    activeChannel?.type === "course_announcements" &&
                    activeChannel.course.id === course.id;
                  const isGenActive =
                    activeChannel?.type === "course" &&
                    activeChannel.course.id === course.id;

                  return (
                    <div key={course.id} style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 6 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#64748b",
                          padding: "6px 8px 2px",
                        }}
                      >
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {course.title}
                        </span>
                        {(unreadChannelKeys[`course:${course.id}`] || unreadChannelKeys[`course_announcements:${course.id}`]) && (
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: "#ef4444",
                              flexShrink: 0,
                            }}
                            className="animate-pulse"
                          />
                        )}
                      </div>

                      {/* 1. Announcements channel */}
                      <button
                        className="ch-item"
                        onClick={() => {
                          openChannel({ type: "course_announcements", course });
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "7px 10px 7px 16px",
                          borderRadius: 6,
                          background: isAnnActive
                            ? "rgba(245,158,11,0.12)"
                            : "transparent",
                          border: isAnnActive
                            ? "1px solid rgba(245,158,11,0.2)"
                            : "1px solid transparent",
                          color: isAnnActive ? "#f59e0b" : "#94a3b8",
                          fontWeight: isAnnActive ? 700 : 400,
                          cursor: "pointer",
                          fontSize: 12,
                          textAlign: "left",
                        }}
                      >
                        <Megaphone style={{ width: 14, height: 14, color: isAnnActive ? "#f59e0b" : "#64748b", flexShrink: 0 }} />
                        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          Announcements
                        </span>
                        {unreadChannelKeys[`course_announcements:${course.id}`] && (
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: "#ef4444",
                              flexShrink: 0,
                            }}
                            className="animate-pulse"
                          />
                        )}
                      </button>

                      {/* 2. General Talk channel */}
                      <button
                        className="ch-item"
                        onClick={() => {
                          openChannel({ type: "course", course });
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "7px 10px 7px 16px",
                          borderRadius: 6,
                          background: isGenActive
                            ? "rgba(99,102,241,0.12)"
                            : "transparent",
                          border: isGenActive
                            ? "1px solid rgba(99,102,241,0.2)"
                            : "1px solid transparent",
                          color: isGenActive ? "#818cf8" : "#94a3b8",
                          fontWeight: isGenActive ? 700 : 400,
                          cursor: "pointer",
                          fontSize: 12,
                          textAlign: "left",
                        }}
                      >
                        <Hash style={{ width: 14, height: 14, color: isGenActive ? "#818cf8" : "#64748b", flexShrink: 0 }} />
                        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          General Talk
                        </span>
                        {unreadChannelKeys[`course:${course.id}`] && (
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: "#ef4444",
                              flexShrink: 0,
                            }}
                            className="animate-pulse"
                          />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* ── SECTION 3: Teacher DMs ────────────────────────────────────────── */}
        <div style={{ padding: "12px 8px 2px", flex: 1 }}>
          <button
            onClick={() => setDmsSectionOpen((v) => !v)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px 6px",
              color: "#64748b",
              fontWeight: 700,
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              textAlign: "left",
            }}
          >
            {dmsSectionOpen ? (
              <ChevronDown style={{ width: 12, height: 12 }} />
            ) : (
              <ChevronRight style={{ width: 12, height: 12 }} />
            )}
            Direct Messages
          </button>

          {dmsSectionOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {!coursesLoading && courses.length === 0 && (
                <div
                  style={{
                    padding: "8px 10px",
                    fontSize: 12,
                    color: "#475569",
                    fontStyle: "italic",
                  }}
                >
                  Enroll in a course to message instructors.
                </div>
              )}
              {(() => {
                // Deduplicate: one DM entry per unique teacher
                const seen = new Set<string>();
                const uniqueTeachers: { teacherName: string; teacherId: string; course: typeof courses[0] }[] = [];
                for (const course of courses) {
                  const tid = getCourseTeacherId(course);
                  if (tid && !seen.has(tid)) {
                    seen.add(tid);
                    uniqueTeachers.push({
                      teacherName: (course as any).teacherName || (course as any).teacher_name || "Instructor",
                      teacherId: tid,
                      course, // first course for this teacher
                    });
                  }
                }
                return uniqueTeachers.map(({ teacherName, teacherId, course }) => {
                  const isActive =
                    activeChannel?.type === "teacher_dm" &&
                    getCourseTeacherId(activeChannel.course) === teacherId;
                  return (
                    <button
                      key={`dm-${teacherId}`}
                      className="ch-item"
                      onClick={() => {
                        openChannel({ type: "teacher_dm", course });
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        padding: "7px 10px",
                        borderRadius: 8,
                        background: isActive
                          ? "rgba(14,165,233,0.1)"
                          : "transparent",
                        border: isActive
                          ? "1px solid rgba(14,165,233,0.18)"
                          : "1px solid transparent",
                        color: isActive ? "#38bdf8" : "#94a3b8",
                        cursor: "pointer",
                        fontSize: 13,
                        textAlign: "left",
                      }}
                    >
                      <Avatar
                        name={teacherName}
                        size={28}
                        gradient={
                          isActive
                            ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
                            : "linear-gradient(135deg,#1e293b,#334155)"
                        }
                        image="/images/paras_teacher.png"
                      />
                      <div
                        style={{
                          overflow: "hidden",
                          flex: 1,
                          textAlign: "left",
                        }}
                      >
                        <div
                          style={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            color: isActive ? "#e2e8f0" : "#cbd5e1",
                            fontWeight: isActive ? 700 : 400,
                            fontSize: 12,
                          }}
                        >
                          {teacherName}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#475569",
                          }}
                        >
                          Your instructor
                        </div>
                      </div>
                      {unreadChannelKeys[`teacher_dm:${teacherId}`] && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#ef4444",
                            flexShrink: 0,
                            marginRight: 4,
                          }}
                          className="animate-pulse"
                        />
                      )}
                      {isActive && (
                        <BookOpen
                          style={{
                            width: 11,
                            height: 11,
                            color: "#38bdf8",
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </button>
                  );
                });
              })()}
            </div>
          )}
        </div>

        {/* Student Profile Footer */}
        <div
          style={{
            padding: "12px 14px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(0,0,0,0.2)",
          }}
        >
          <Avatar
            name={user?.fullName || (user as any)?.full_name || "Student"}
            size={34}
            gradient="linear-gradient(135deg,#0ea5e9,#6366f1)"
          />
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#f1f5f9",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {(user as any)?.full_name || user?.fullName || "Student"}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#4f46e5",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Sparkles style={{ width: 10, height: 10 }} />
                {/* Capitalize role from API ("student" → "Student") */}
                {((user as any)?.role || user?.role || "student")
                  .charAt(0).toUpperCase() +
                  ((user as any)?.role || user?.role || "student").slice(1).toLowerCase()}
            </div>
          </div>
          {/* Connection status dot */}
          {room && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                color: statusDot?.color,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              <Circle
                style={{
                  width: 7,
                  height: 7,
                  fill: statusDot?.color,
                  color: statusDot?.color,
                  animation:
                    connectionStatus === "connecting" ||
                    connectionStatus === "reconnecting"
                      ? "pulse 1.2s infinite"
                      : undefined,
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN CHAT AREA ───────────────────────────────────────────────────── */}
      <div
        className="flex-1 flex-col h-full min-h-0 bg-[#080c14] min-w-0 overflow-hidden"
        style={{
          display: isMobile && !mobileShowChat ? "none" : "flex",
        }}
      >
        {/* Chat Header */}
        <div
          className="px-3 sm:px-5 py-2 sm:py-0 min-h-[58px] sm:h-[62px] border-b border-white/5 bg-[#0b0f1a]/95 backdrop-blur-md flex items-center justify-between gap-2 shrink-0 z-10"
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => setMobileShowChat(false)}
              className="md:hidden p-1.5 -ml-1 rounded-lg bg-white/5 text-slate-300 hover:text-white shrink-0"
              aria-label="Back to channels"
            >
              <ArrowLeft style={{ width: 18, height: 18 }} />
            </button>
            <div
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: !activeChannel
                  ? "linear-gradient(135deg,#334155,#475569)"
                  : activeChannel.type === "announcements"
                  ? "linear-gradient(135deg,#d97706,#f59e0b)"
                  : activeChannel.type === "course"
                  ? "linear-gradient(135deg,#4f46e5,#7c3aed)"
                  : "linear-gradient(135deg,#0284c7,#0ea5e9)",
              }}
            >
              {(!activeChannel || activeChannel.type === "course") && (
                <Hash style={{ width: 18, height: 18, color: "#fff" }} />
              )}
              {activeChannel?.type === "announcements" && (
                <Megaphone style={{ width: 18, height: 18, color: "#fff" }} />
              )}
              {activeChannel?.type === "teacher_dm" && (
                <UserCheck style={{ width: 18, height: 18, color: "#fff" }} />
              )}
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div
                className="text-sm sm:text-[15px] font-extrabold text-slate-100 truncate tracking-tight"
                title={channelTitle}
              >
                {channelTitle}
              </div>
              <div
                className="text-[10px] sm:text-xs text-slate-400 truncate mt-0.5"
                title={channelSubtitle}
              >
                {channelSubtitle}
              </div>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {room && (
              <div
                className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold"
                style={{ color: statusDot?.color }}
              >
                <Circle
                  style={{
                    width: 6,
                    height: 6,
                    fill: statusDot?.color,
                    color: statusDot?.color,
                    animation:
                      connectionStatus === "connecting" ||
                      connectionStatus === "reconnecting"
                        ? "pulse 1.2s infinite"
                        : undefined,
                  }}
                />
                <span className="hidden xs:inline">{statusDot?.label}</span>
              </div>
            )}
            <button
              onClick={() => setShowInfoPanel((v) => !v)}
              className={cn(
                "p-1.5 sm:p-2 rounded-lg border border-white/10 text-slate-400 hover:text-white transition-colors",
                showInfoPanel ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" : "bg-white/5"
              )}
              aria-label="Channel Info"
            >
              <Info style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* Message Feed */}
        <div
          ref={chatContainerRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* No channel selected */}
          {!activeChannel && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 12,
                color: "#334155",
              }}
            >
              <MessageSquare
                style={{ width: 52, height: 52, opacity: 0.15, color: "#818cf8" }}
              />
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#475569",
                }}
              >
                Select a channel to start
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#334155",
                  textAlign: "center",
                  maxWidth: 280,
                }}
              >
                Choose a course discussion, announcements, or teacher DM from
                the sidebar.
              </div>
            </div>
          )}

          {/* Room error */}
          {activeChannel && roomError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 18px",
                borderRadius: 12,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#fca5a5",
                fontSize: 13,
              }}
            >
              <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
              {roomError}
            </div>
          )}

          {/* Loading */}
          {activeChannel && !roomError && messagesLoading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 10,
                color: "#64748b",
              }}
            >
              <Loader2
                style={{
                  width: 20,
                  height: 20,
                  animation: "spin 1s linear infinite",
                }}
              />
              <span style={{ fontSize: 14 }}>Loading messages...</span>
            </div>
          )}

          {/* Messages */}
          {!messagesLoading &&
            messages.map((msg, idx) => {
              const isTeacher =
                ["teacher", "TEACHER"].includes(msg.sender?.role || "");
              const isSelf = msg.sender?.id === user?.id;
              const isDeleted = Boolean(msg.is_deleted);
              const senderName = isSelf
                ? "You"
                : msg.sender?.full_name || "User";
              const isFirstUnread = firstUnreadMessageId === msg.id;

              return (
                <React.Fragment key={msg.id || `msg-${idx}`}>
                  {isFirstUnread && (
                    <div
                      id={`unread-marker-${msg.id}`}
                      ref={firstUnreadRef}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        margin: "12px 0 8px",
                        width: "100%",
                      }}
                    >
                      <div style={{ flex: 1, height: 1, background: "rgba(99,102,241,0.35)" }} />
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          padding: "3px 12px",
                          borderRadius: 20,
                          background: "rgba(99,102,241,0.18)",
                          color: "#a5b4fc",
                          border: "1px solid rgba(99,102,241,0.35)",
                          boxShadow: "0 2px 8px rgba(99,102,241,0.2)",
                        }}
                      >
                        Unread Messages
                      </span>
                      <div style={{ flex: 1, height: 1, background: "rgba(99,102,241,0.35)" }} />
                    </div>
                  )}
                  <div
                    id={`msg-${msg.id}`}
                    style={{
                      display: "flex",
                      flexDirection: isSelf ? "row-reverse" : "row",
                      alignItems: "flex-end",
                      gap: 10,
                      animation: "fadeInUp 0.2s ease",
                    }}
                  >
                  {!isSelf && (
                    <Avatar
                      name={senderName}
                      size={34}
                      gradient={
                        isTeacher
                          ? "linear-gradient(135deg,#7c3aed,#4f46e5)"
                          : "linear-gradient(135deg,#0284c7,#0ea5e9)"
                      }
                    />
                  )}
                  <div
                    style={{
                      maxWidth: "72%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isSelf ? "flex-end" : "flex-start",
                      gap: 3,
                    }}
                  >
                    {!isSelf && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: isTeacher ? "#a78bfa" : "#94a3b8",
                          paddingLeft: 4,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {senderName}
                        {isTeacher && (
                          <span
                            style={{
                              fontSize: 9,
                              background: "rgba(124,58,237,0.2)",
                              color: "#a78bfa",
                              padding: "1px 5px",
                              borderRadius: 4,
                              fontWeight: 700,
                            }}
                          >
                            INSTRUCTOR
                          </span>
                        )}
                      </span>
                    )}

                    {/* Message Bubble */}
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: isSelf
                          ? "16px 16px 2px 16px"
                          : "16px 16px 16px 2px",
                        background: isDeleted
                          ? "rgba(255,255,255,0.03)"
                          : isSelf
                          ? "linear-gradient(135deg,#4f46e5,#6366f1)"
                          : isTeacher
                          ? "rgba(124,58,237,0.12)"
                          : "rgba(255,255,255,0.06)",
                        border: isDeleted
                          ? "1px solid rgba(255,255,255,0.06)"
                          : isSelf
                          ? "none"
                          : isTeacher
                          ? "1px solid rgba(124,58,237,0.25)"
                          : "1px solid rgba(255,255,255,0.08)",
                        color: isDeleted
                          ? "#475569"
                          : isSelf
                          ? "#fff"
                          : "#e2e8f0",
                        fontSize: isDeleted ? 12 : 13,
                        fontStyle: isDeleted ? "italic" : "normal",
                        lineHeight: 1.5,
                        wordBreak: "break-word",
                        boxShadow: isSelf
                          ? "0 4px 14px rgba(79,70,229,0.3)"
                          : "none",
                      }}
                    >
                      {msg.content}

                      {/* Photo attachments */}
                      {!isDeleted && msg.attachments && msg.attachments.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 6,
                            marginTop: 8,
                          }}
                        >
                          {msg.attachments.map((att: any, attIdx: number) => {
                            const rawUrl = att.url || att.r2_url || "";
                            const photoSrc =
                              rawUrl.startsWith("http") || rawUrl.startsWith("data:")
                                ? rawUrl
                                : `https://pub-24a225d578474f4fb5b75f2a90813a11.r2.dev/${rawUrl.replace(/^\//, "")}`;
                            return (
                              <div
                                key={attIdx}
                                style={{
                                  borderRadius: 8,
                                  overflow: "hidden",
                                  border: "1px solid rgba(255,255,255,0.15)",
                                }}
                              >
                                <img
                                  src={photoSrc}
                                  alt={att.file_name || "Photo attachment"}
                                  style={{
                                    maxWidth: 260,
                                    maxHeight: 200,
                                    objectFit: "cover",
                                    borderRadius: 8,
                                    cursor: "pointer",
                                    display: "block",
                                  }}
                                  onClick={() => setLightboxPhoto(photoSrc)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Direct image in content */}
                      {!isDeleted && (!msg.attachments || msg.attachments.length === 0) && (msg.content_type === "image" || /\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i.test(msg.content.trim()) || msg.content.trim().startsWith("data:image/")) && (
                        <div style={{ marginTop: 8, borderRadius: 8, overflow: "hidden" }}>
                          <img
                            src={msg.content.trim().startsWith("http") || msg.content.trim().startsWith("data:") ? msg.content.trim() : `https://pub-24a225d578474f4fb5b75f2a90813a11.r2.dev/${msg.content.trim().replace(/^\//, "")}`}
                            alt="Chat photo"
                            style={{
                              maxWidth: 280,
                              maxHeight: 220,
                              objectFit: "cover",
                              borderRadius: 8,
                              cursor: "pointer",
                              display: "block",
                            }}
                            onClick={() => setLightboxPhoto(msg.content.trim().startsWith("http") || msg.content.trim().startsWith("data:") ? msg.content.trim() : `https://pub-24a225d578474f4fb5b75f2a90813a11.r2.dev/${msg.content.trim().replace(/^\//, "")}`)}
                          />
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        color: "#475569",
                        paddingLeft: 4,
                        paddingRight: 4,
                      }}
                    >
                      {formatTime(msg.created_at)}
                      {msg.is_edited && (
                        <span style={{ marginLeft: 4, opacity: 0.7 }}>
                          (edited)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {/* Empty state */}
          {!messagesLoading && messages.length === 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: 1,
                  gap: 10,
                  color: "#475569",
                  paddingBottom: 30,
                }}
              >
                {activeChannel?.type === "announcements" ? (
                  <>
                    <Megaphone
                      style={{ width: 38, height: 38, opacity: 0.25, color: "#f59e0b" }}
                    />
                    <span style={{ fontSize: 14 }}>
                      No announcements yet from your instructor.
                    </span>
                  </>
                ) : activeChannel?.type === "teacher_dm" ? (
                  <>
                    <UserCheck
                      style={{ width: 38, height: 38, opacity: 0.25, color: "#38bdf8" }}
                    />
                    <span style={{ fontSize: 14 }}>
                      No messages yet with{" "}
                      {(activeChannel.course as any)?.teacherName ||
                        "your instructor"}
                      . Send a note!
                    </span>
                  </>
                ) : (
                  <>
                    <MessageSquare
                      style={{ width: 38, height: 38, opacity: 0.25, color: "#818cf8" }}
                    />
                    <span style={{ fontSize: 14 }}>
                      No messages yet. Start the conversation! 👋
                    </span>
                  </>
                )}
              </div>
            )}

          <div ref={messagesEndRef} />
        </div>

        {/* Typing indicator */}
        {typingLabel && activeChannel?.type === "course" && (
          <div
            style={{
              padding: "4px 24px 2px",
              fontSize: 11,
              color: "#818cf8",
              fontStyle: "italic",
              flexShrink: 0,
            }}
          >
            {typingLabel}
          </div>
        )}

        {/* Read-Only Banner (Announcements) */}
        {isReadOnly && (
          <div
            style={{
              padding: "12px 20px",
              paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(245,158,11,0.06)",
              color: "#f59e0b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            <Lock style={{ width: 14, height: 14 }} />
            Announcement Channel — Read-Only. Only instructors can post here.
          </div>
        )}

        {/* Input Bar — hidden for read-only channels */}
        {activeChannel && !isReadOnly && (
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(11,15,26,0.8)",
              backdropFilter: "blur(10px)",
              flexShrink: 0,
            }}
          >
            {/* Photo Previews above input */}
            {photoPreviews.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "8px 14px",
                  background: "rgba(15,23,42,0.8)",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  overflowX: "auto",
                }}
              >
                {photoPreviews.map((src, i) => (
                  <div
                    key={i}
                    style={{
                      position: "relative",
                      width: 52,
                      height: 52,
                      borderRadius: 8,
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.2)",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={src}
                      alt="Preview"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      style={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: "rgba(0,0,0,0.75)",
                        color: "#fff",
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      <X style={{ width: 10, height: 10 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={handleSend}
              style={{
                padding: "14px 18px",
                paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div className="hidden sm:flex">
                <Avatar
                  name={(user as any)?.full_name || user?.fullName || "You"}
                  size={34}
                  gradient="linear-gradient(135deg,#0ea5e9,#6366f1)"
                />
              </div>

              {/* Hidden file input */}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*,image/png,image/jpeg,image/webp,image/gif"
                multiple
                style={{ display: "none" }}
                onChange={handlePhotoSelect}
              />

              {/* Photo Attachment Button */}
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                title="Attach photos (PNG, JPG, WEBP)"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                  color: selectedPhotos.length > 0 ? "#38bdf8" : "#94a3b8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "all 0.15s",
                }}
              >
                <ImageIcon style={{ width: 18, height: 18 }} />
              </button>

              <input
                id="chat-message-input"
                className="msg-input"
                type="text"
                placeholder={
                  selectedPhotos.length > 0
                    ? `Add a caption for ${selectedPhotos.length} photo(s)...`
                    : !room
                    ? "Connecting to room..."
                    : isTeacherDm
                    ? `Message ${
                        (activeChannel?.course as any)?.teacherName ||
                        "Instructor"
                      }...`
                    : connectionStatus === "connected"
                    ? "Type a message..."
                    : "Connecting..."
                }
                value={draft}
                disabled={!room || sending}
                onChange={(e) => {
                  setDraft(e.target.value);
                  handleTyping();
                }}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e as any);
                  }
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                  padding: "10px 14px",
                  fontSize: 14,
                  color: "#f1f5f9",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
              />
              <button
                id="chat-send-btn"
                type="submit"
                className="send-btn"
                disabled={(!draft.trim() && selectedPhotos.length === 0) || !room || sending}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  borderRadius: 12,
                  background: isTeacherDm
                    ? "linear-gradient(135deg,#0284c7,#0369a1)"
                    : "linear-gradient(135deg,#4f46e5,#7c3aed)",
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "filter 0.15s, transform 0.15s",
                }}
              >
                {sending ? (
                  <Loader2
                    style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }}
                  />
                ) : (
                  <Send style={{ width: 16, height: 16 }} />
                )}
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ── RIGHT INFO PANEL ─────────────────────────────────────────────────── */}
      {showInfoPanel && (
        <>
          {/* Mobile backdrop overlay */}
          <div
            className="md:hidden"
            onClick={() => setShowInfoPanel(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
              zIndex: 40,
            }}
          />

          <div
            className="fixed inset-y-0 right-0 z-50 md:static md:z-auto shadow-2xl md:shadow-none"
            style={{
              width: 280,
              background: "#0b0f1a",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 18,
              overflowY: "auto",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 8,
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Channel Info
              </div>
              <button
                type="button"
                onClick={() => setShowInfoPanel(false)}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "none",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#94a3b8",
                  cursor: "pointer",
                }}
                title="Close channel info"
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

          {!activeChannel && (
            <div style={{ fontSize: 13, color: "#475569" }}>
              Select a channel to see details.
            </div>
          )}

          {activeChannel?.type === "announcements" && (
            <div
              style={{
                background: "rgba(245,158,11,0.06)",
                border: "1px solid rgba(245,158,11,0.15)",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  color: "#f59e0b",
                  marginBottom: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Megaphone style={{ width: 14, height: 14 }} />
                Announcements
              </div>
              <div
                style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}
              >
                Official announcements from your instructor across{" "}
                <strong style={{ color: "#94a3b8" }}>
                  all your enrolled courses
                </strong>
                . This channel is read-only for students.
              </div>
            </div>
          )}

          {activeChannel?.type === "course" && (
            <div
              style={{
                background: "rgba(99,102,241,0.06)",
                border: "1px solid rgba(99,102,241,0.15)",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  color: "#818cf8",
                  marginBottom: 4,
                }}
              >
                {activeChannel.course.title}
              </div>
              <div style={{ fontSize: 11, color: "#475569" }}>
                Instructor:{" "}
                {(activeChannel.course as any).teacherName || "Instructor"}
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "#64748b",
                  lineHeight: 1.6,
                }}
              >
                Group discussion open to all enrolled students and the
                instructor.
              </div>
            </div>
          )}

          {activeChannel?.type === "teacher_dm" && (
            <div
              style={{
                background: "rgba(14,165,233,0.06)",
                border: "1px solid rgba(14,165,233,0.15)",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <Avatar
                name={
                  (activeChannel.course as any).teacherName || "Paras (Construction)"
                }
                size={44}
                gradient="linear-gradient(135deg,#6366f1,#8b5cf6)"
                image="/images/paras_teacher.png"
              />
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  color: "#e2e8f0",
                  marginTop: 10,
                }}
              >
                {(activeChannel.course as any).teacherName || "Paras (Construction)"}
              </div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                Instructor
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "#64748b",
                  lineHeight: 1.6,
                }}
              >
                Private 1-on-1 direct message thread with your instructor.
              </div>
            </div>
          )}

          {/* Enrollment summary */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
              }}
            >
              My Enrollment
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "#94a3b8",
                }}
              >
                <span>Enrolled Courses</span>
                <span style={{ fontWeight: 700, color: "#818cf8" }}>
                  {courses.length}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "#94a3b8",
                }}
              >
                <span>Messages Loaded</span>
                <span style={{ fontWeight: 700, color: "#22c55e" }}>
                  {messages.length}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "#94a3b8",
                }}
              >
                <span>Connection</span>
                <span
                  style={{ fontWeight: 700, color: statusDot?.color }}
                >
                  {statusDot?.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </>
      )}

      {/* Photo Lightbox Modal */}
      {lightboxPhoto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, width: "100%", marginBottom: 12 }}>
              <button
                onClick={() => {
                  if (lightboxPhoto.startsWith("data:")) {
                    const win = window.open("");
                    if (win) {
                      win.document.write(
                        `<!DOCTYPE html><html><head><title>Photo Preview</title><style>body{margin:0;background:#090d16;display:flex;align-items:center;justify-content:center;height:100vh;}img{max-width:100%;max-height:100%;object-fit:contain;}</style></head><body><img src="${lightboxPhoto}"/></body></html>`
                      );
                      win.document.close();
                    }
                  } else {
                    window.open(lightboxPhoto, "_blank");
                  }
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <ExternalLink style={{ width: 14, height: 14 }} /> Open in New Tab
              </button>
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = lightboxPhoto;
                  a.download = "chat_photo.jpg";
                  a.click();
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  backgroundColor: "rgba(99,102,241,0.25)",
                  color: "#818cf8",
                  border: "1px solid rgba(99,102,241,0.4)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Download style={{ width: 14, height: 14 }} /> Download
              </button>
              <button
                onClick={() => setLightboxPhoto(null)}
                style={{
                  padding: 6,
                  borderRadius: 8,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <img
              src={lightboxPhoto}
              alt="Photo Preview"
              style={{
                maxHeight: "80vh",
                maxWidth: "100%",
                objectFit: "contain",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.15)",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
