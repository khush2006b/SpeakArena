"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Hash,
  Megaphone,
  MessageSquare,
  Users,
  Send,
  Lock,
  Unlock,
  Sparkles,
  Info,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Image as ImageIcon,
  ExternalLink,
  Download,
  Trash2,
} from "lucide-react";
import { apiClient } from "@/services/api/client";
import { useAuthStore } from "@/stores/auth.store";
import {
  connectChatSocket,
  disconnectChatSocket,
  getChatSocket,
  socketEvents,
} from "@/services/socket.client";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeacherCourse {
  id: string;
  title: string;
  slug?: string;
  status?: string;
  level?: string;
  total_enrollments?: number;
}

interface ChatRoomData {
  id: string;
  course_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  slow_mode_seconds: number;
}

interface BackendUser {
  id: string;
  full_name?: string;
  name?: string;
  avatar_r2_key?: string;
  role: string;
}

interface BackendMessage {
  id: string;
  chat_room_id: string;
  sender_id: string;
  recipient_id?: string | null | undefined;
  content: string;
  content_type: string;
  is_pinned: boolean;
  is_announcement: boolean;
  is_deleted?: boolean;
  attachments?: any[];
  created_at: string;
  sender?: BackendUser;
}

interface PlatformStudent {
  student_id: string;
  student_name: string;
  student_email: string;
  student_avatar_r2_key?: string;
  is_active?: boolean;
}

function getStudentUserId(student: any): string {
  if (!student) return "";
  return String(
    student.student_id ||
    student.studentId ||
    student.id ||
    student.user_id ||
    student.userId ||
    ""
  );
}

// The active "channel" can be:
// - "announcements"  → global broadcast
// - "course:{id}"    → course discussion room
// - "dm:{studentId}" → private DM with a student
type ActiveChannel =
  | { type: "announcements" }
  | { type: "course"; course: TeacherCourse; subType?: "announcements" | "general" }
  | { type: "dm"; student: PlatformStudent };

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
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function Avatar({
  name,
  size = 34,
  gradient = "linear-gradient(135deg,#7c3aed,#4f46e5)",
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
        color: "hsl(var(--foreground))",
        flexShrink: 0,
        letterSpacing: "-0.5px",
      }}
    >
      {getInitials(name)}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TeacherCommunicationView() {
  const { user } = useAuthStore();

  // Data
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [allStudents, setAllStudents] = useState<PlatformStudent[]>([]);

  // Active channel selection
  const [activeChannel, setActiveChannel] = useState<ActiveChannel>({
    type: "announcements",
  });

  // Room (loaded per selected course)
  const [room, setRoom] = useState<ChatRoomData | null>(null);
  // All announcement rooms — used by the global Announcements tab to subscribe
  // to real-time events across ALL courses simultaneously.
  const [announcementRooms, setAnnouncementRooms] = useState<ChatRoomData[]>([]);
  const announcementRoomsRef = useRef<ChatRoomData[]>([]);

  // Section collapse state
  const [coursesSectionOpen, setCoursesSectionOpen] = useState(true);
  const [dmsSectionOpen, setDmsSectionOpen] = useState(true);
  const [showChannelSidebar, setShowChannelSidebar] = useState(true);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Messages & Attachments
  const [messages, setMessages] = useState<BackendMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
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

  // Loading
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<string | null>(null);

  // UI
  const [slowMode, setSlowMode] = useState<number>(0);
  const [showInfoPanel, setShowInfoPanel] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const firstUnreadRef = useRef<HTMLDivElement>(null);

  // Refs for WS handler (avoid stale closures)
  const activeChannelRef = useRef<ActiveChannel>({ type: "announcements" });
  const roomRef = useRef<ChatRoomData | null>(null);
  const userIdRef = useRef<string>("");

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);
  }, []);

  useEffect(() => { activeChannelRef.current = activeChannel; }, [activeChannel]);
  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { userIdRef.current = String((user as any)?.id || ""); }, [user]);
  useEffect(() => { announcementRoomsRef.current = announcementRooms; }, [announcementRooms]);

  // ── Derived active-course for course channels ────────────────────────────────

  // ── Fetch Teacher's Courses ──────────────────────────────────────────────────
  useEffect(() => {
    setCoursesLoading(true);
    apiClient
      .get("/api/v1/teacher/courses")
      .then((res: any) => {
        const list: TeacherCourse[] = res.data?.data ?? [];
        setCourses(list);
        if (list.length > 0) {
          setActiveChannel((prev) => {
            if (prev.type === "dm" && prev.student) return prev;
            if (prev.type === "announcements") return prev;
            return { type: "course", course: list[0] };
          });
        }
      })
      .catch(() => {})
      .finally(() => setCoursesLoading(false));
  }, []);

  // ── Fetch All Platform Students ──────────────────────────────────────────────
  useEffect(() => {
    setStudentsLoading(true);
    const url = studentSearchQuery
      ? `/api/v1/teacher/all-students?search=${encodeURIComponent(studentSearchQuery)}`
      : "/api/v1/teacher/all-students";
    apiClient
      .get(url)
      .then((res: any) => {
        const list = res.data?.data?.items || res.data?.data || [];
        const formatted: PlatformStudent[] = list.map((st: any) => ({
          student_id: st.student_id || st.id,
          student_name: st.student_name || st.full_name || st.name || "Student",
          student_email: st.student_email || st.email || "",
          student_avatar_r2_key: st.student_avatar_r2_key || st.avatar_r2_key,
          is_active: st.is_active,
        }));
        setAllStudents(formatted);

        // Auto-select student DM if navigated with email or studentId search param
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const emailParam = params.get("email");
          const studentIdParam = params.get("studentId") || params.get("student");

          if (emailParam || studentIdParam) {
            const match = formatted.find(
              (s) =>
                (emailParam && s.student_email.toLowerCase() === emailParam.toLowerCase()) ||
                (studentIdParam && (s.student_id === studentIdParam || s.student_email === studentIdParam))
            );
            if (match) {
              setActiveChannel({ type: "dm", student: match });
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setStudentsLoading(false));
  }, [studentSearchQuery]);

  // ── Fetch Chat Room for any channel type ────────────────────────────────────
  useEffect(() => {
    if (activeChannel.type === "course") {
      const course = activeChannel.course;
      if (!course || !course.id) return;
      const roomType = activeChannel.subType === "announcements" ? "announcement" : "general";
      setMessages([]);
      setRoom(null);
      setAnnouncementRooms([]);
      apiClient
        .get(`/api/v1/chat/${course.id}?room_type=${roomType}`)
        .then((res: any) => {
          const r: ChatRoomData = res.data?.data;
          setRoom(r);
          setSlowMode(r?.slow_mode_seconds ?? 0);
        })
        .catch(() => {});

    } else if (activeChannel.type === "announcements" && courses.length > 0) {
      // For the global Announcements tab: fetch the global_announcement room for EVERY
      // course and connect a WebSocket to each. This isolates global broadcasts
      // from course-specific announcement rooms.
      setMessages([]);
      setRoom(null);
      setAnnouncementRooms([]);
      const validCourses = courses.filter((c) => Boolean(c?.id));
      Promise.all(
        validCourses.map((c) =>
          apiClient
            .get(`/api/v1/chat/${c.id}?room_type=global_announcement`)
            .then((res: any) => res.data?.data as ChatRoomData | null)
            .catch(() => null)
        )
      ).then((rooms) => {
        const loaded = rooms.filter(Boolean) as ChatRoomData[];
        setAnnouncementRooms(loaded);
        if (loaded.length > 0) setRoom(loaded[0]);
      });

    } else if (activeChannel.type === "dm" && courses.length > 0) {
      // For DMs: connect WS to the general room of the relevant course (DMs are
      // routed through user channels, so the room is mainly for WS auth/presence).
      const courseId =
        (activeChannel.student as any)?.course_id ||
        (activeChannel.student as any)?.courseId ||
        courses[0]?.id;
      if (!courseId) return;
      setMessages([]);
      setRoom(null);
      setAnnouncementRooms([]);
      apiClient
        .get(`/api/v1/chat/${courseId}?room_type=general`)
        .then((res: any) => {
          const r: ChatRoomData = res.data?.data;
          setRoom(r);
          setSlowMode(0);
        })
        .catch(() => {});
    }
  }, [activeChannel, courses]);


  // ── Safe WS message append (no stale closure) ────────────────────────────────
  const safeAppendMessage = useCallback(
    (msg: BackendMessage) => {
      if (!msg || !msg.id || !msg.content) return;

      const ch = activeChannelRef.current;
      const currentRoom = roomRef.current;
      const myId = userIdRef.current.toLowerCase();
      const msgSenderId = String(msg.sender?.id || msg.sender_id || "").toLowerCase();
      const msgRecipientId = String(msg.recipient_id || "").toLowerCase();

      // Handle direct messages
      if (msg.recipient_id) {
        if (msgRecipientId === myId || msgSenderId === myId) {
          const stId = String(ch?.type === "dm" ? getStudentUserId(ch.student) : "").toLowerCase();
          if (ch?.type === "dm" && (msgSenderId === stId || msgRecipientId === stId || !stId)) {
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
            scrollToBottom();
          } else if (msgRecipientId === myId && msgSenderId !== myId) {
            toast.info(`New DM from ${msg.sender?.full_name || "Student"}: ${msg.content.slice(0, 40)}`);
          }
          return;
        }
      }

      // Room guard for course discussion / announcement channels.
      // For the global Announcements tab: accept messages from ANY announcement room
      // (we are subscribed to all of them). For other channels: strict single-room check.
      if (msg.chat_room_id && ch?.type !== "dm") {
        if (ch?.type === "announcements") {
          const knownRoomIds = announcementRoomsRef.current.map((r) =>
            String(r.id).toLowerCase()
          );
          const msgRoomId = String(msg.chat_room_id).toLowerCase();
          if (knownRoomIds.length > 0 && !knownRoomIds.includes(msgRoomId)) return;
        } else if (currentRoom?.id) {
          if (
            String(msg.chat_room_id).toLowerCase() !==
            String(currentRoom.id).toLowerCase()
          )
            return;
        }
      }

      if (ch?.type === "announcements") {
        if (!msg.is_announcement) return;
      } else if (ch?.type === "course") {
        const isAnnSub = ch.subType === "announcements";
        if (isAnnSub) {
          if (msg.recipient_id) return;
        } else {
          if (msg.is_announcement || msg.recipient_id) return;
        }
      }


      setMessages((prev) => {
        if (prev.some((m) => String(m.id).toLowerCase() === String(msg.id).toLowerCase()))
          return prev;

        // For General Announcements (global broadcast), deduplicate by content + sender within a 1-minute window
        if (ch?.type === "announcements") {
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

      const container = chatContainerRef.current;
      const isNearBottom = container
        ? container.scrollHeight - container.scrollTop - container.clientHeight < 180
        : true;
      if (isNearBottom || isMine) {
        requestAnimationFrame(() => {
          chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
        });
      }
    },
    []
  );

  // ── Fetch Message History ────────────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    if (activeChannel.type === "dm" && !activeChannel.student) {
      setMessages([]);
      return;
    }
    if (courses.length === 0) return;

    setMessagesLoading(true);

    let key = "";
    if (activeChannel.type === "announcements") {
      key = "announcements";
    } else if (activeChannel.type === "course") {
      key = activeChannel.subType === "announcements"
        ? `course_announcements:${activeChannel.course.id}`
        : `course:${activeChannel.course.id}`;
    } else if (activeChannel.type === "dm") {
      const studentId = getStudentUserId(activeChannel.student);
      key = studentId ? `teacher_dm:${studentId}` : "";
    }

    try {
      const validCourses = courses.filter((c) => Boolean(c?.id));
      let fetchedMsgs: BackendMessage[] = [];

      if (activeChannel.type === "course") {
        if (!activeChannel.course?.id) {
          setMessages([]);
          setMessagesLoading(false);
          return;
        }
        const isAnn = activeChannel.subType === "announcements";
        const url = isAnn
          ? `/api/v1/chat/${activeChannel.course.id}/messages?limit=50&room_type=announcement&announcements_only=true`
          : `/api/v1/chat/${activeChannel.course.id}/messages?limit=50&room_type=general&public_only=true`;
        const res = await apiClient.get(url);
        let msgs: BackendMessage[] = res.data?.data?.messages ?? [];
        fetchedMsgs = [...msgs].reverse();

      } else if (activeChannel.type === "announcements") {
        // Collect announcements across ALL teacher courses
        const results = await Promise.all(
          validCourses.map((c) =>
            apiClient
              .get(`/api/v1/chat/${c.id}/messages?limit=50&room_type=global_announcement&announcements_only=true`)
              .then((res: any) => (res.data?.data?.messages ?? []) as BackendMessage[])
              .catch(() => [] as BackendMessage[])
          )
        );
        // Merge, filter, de-dup by id and content+sender+time window, sort oldest-first
        const allMsgs = results.flat().filter((m) => m.is_announcement);
        const seen = new Set<string>();
        const unique = allMsgs.filter((m) => {
          if (seen.has(m.id)) return false;
          const senderId = m.sender_id || m.sender?.id || "";
          const timeKey = Math.floor(new Date(m.created_at).getTime() / 60000);
          const contentKey = `${m.content?.trim()}__${senderId}__${timeKey}`;
          if (seen.has(contentKey)) return false;
          seen.add(m.id);
          seen.add(contentKey);
          return true;
        });
        unique.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        fetchedMsgs = unique;

      } else if (activeChannel.type === "dm") {
        // Collect DM threads across ALL teacher courses for this student
        const studentId = getStudentUserId(activeChannel.student);
        if (!studentId) {
          setMessages([]);
          setMessagesLoading(false);
          return;
        }
        const results = await Promise.all(
          validCourses.map((c) =>
            apiClient
              .get(`/api/v1/chat/${c.id}/messages?limit=50&dm_student_id=${studentId}`)
              .then((res: any) => (res.data?.data?.messages ?? []) as BackendMessage[])
              .catch(() => [] as BackendMessage[])
          )
        );
        const allMsgs = results.flat().filter((m) => !m.is_announcement && Boolean(m.recipient_id));
        const seen = new Set<string>();
        const unique = allMsgs.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        unique.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        fetchedMsgs = unique;
      }

      setMessages(fetchedMsgs);

      // Determine first unread message
      const lastReadTs = Number(typeof window !== "undefined" && key ? localStorage.getItem(`sa_read_ts_${key}`) || "0" : "0");
      const myId = String((user as any)?.id || "").toLowerCase();

      let firstUnread: BackendMessage | null = null;
      if (lastReadTs > 0 && fetchedMsgs.length > 0) {
        for (let i = 0; i < fetchedMsgs.length; i++) {
          const m = fetchedMsgs[i];
          const senderId = String(m.sender?.id || m.sender_id || "").toLowerCase();
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
        if (targetUnreadId) {
          const el = document.getElementById(`unread-marker-${targetUnreadId}`) || document.getElementById(`msg-${targetUnreadId}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
        }
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      };

      requestAnimationFrame(scrollToTarget);
      setTimeout(scrollToTarget, 60);
      setTimeout(scrollToTarget, 180);
      setTimeout(scrollToTarget, 400);

      // Mark as read in store and storage
      if (key && fetchedMsgs.length > 0) {
        const latest = fetchedMsgs[fetchedMsgs.length - 1];
        useChatStore.getState().markChannelRead(key);
        if (typeof window !== "undefined") {
          localStorage.setItem(`sa_read_ts_${key}`, String(Date.now()));
          if (latest?.id) localStorage.setItem(key, latest.id);
        }
        apiClient.post("/api/v1/chat/read", { 
          channel_key: key, 
          message_id: latest?.id,
          dm_user_id: activeChannel.type === "dm" ? getStudentUserId(activeChannel.student) : undefined
        }).catch(() => {});
      }
    } catch {
      // keep empty
    } finally {
      setMessagesLoading(false);
    }
  }, [activeChannel, courses, user]);

  useEffect(() => {
    setMessages([]);
    fetchMessages();
  }, [fetchMessages]);

  // ── WebSocket connection ──────────────────────────────────────────────────────
  // For course/DM channels: connect to a single room.
  // For the global Announcements tab: connect to ALL course announcement rooms
  // simultaneously so real-time events from any course are received instantly.
  useEffect(() => {
    const ch = activeChannelRef.current;

    if (ch.type === "announcements") {
      // Multi-room mode: subscribe to every announcement room loaded
      if (announcementRooms.length === 0) return;

      const onMessageNew = (payload: any) => {
        const incoming: BackendMessage = payload?.message || payload;
        if (incoming && incoming.content) safeAppendMessage(incoming);
      };

      const onMessageDeleted = (payload: any) => {
        const messageId = payload?.message_id || payload?.id;
        if (!messageId) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, content: "[Message deleted]", is_deleted: true }
              : m
          )
        );
      };

      announcementRooms.forEach((r) => {
        connectChatSocket(r.id);
        getChatSocket(r.id).on(socketEvents.chat.MESSAGE_RECEIVED, onMessageNew);
        getChatSocket(r.id).on("message.deleted", onMessageDeleted);
      });

      return () => {
        announcementRooms.forEach((r) => {
          getChatSocket(r.id).off(socketEvents.chat.MESSAGE_RECEIVED, onMessageNew);
          getChatSocket(r.id).off("message.deleted", onMessageDeleted);
          disconnectChatSocket(r.id);
        });
      };
    } else {
      // Single-room mode: course discussion or DM presence room
      if (!room?.id) return;

      const onMessageNew = (payload: any) => {
        const incoming: BackendMessage = payload?.message || payload;
        if (incoming && incoming.content) safeAppendMessage(incoming);
      };

      const onMessageDeleted = (payload: any) => {
        const messageId = payload?.message_id || payload?.id;
        if (!messageId) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, content: "[Message deleted]", is_deleted: true }
              : m
          )
        );
      };

      connectChatSocket(room.id);
      getChatSocket(room.id).on(socketEvents.chat.MESSAGE_RECEIVED, onMessageNew);
      getChatSocket(room.id).on("message.deleted", onMessageDeleted);

      return () => {
        getChatSocket(room.id).off(socketEvents.chat.MESSAGE_RECEIVED, onMessageNew);
        getChatSocket(room.id).off("message.deleted", onMessageDeleted);
        disconnectChatSocket(room.id);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, announcementRooms, safeAppendMessage]);


  // ── Send Message ─────────────────────────────────────────────────────────────
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && selectedPhotos.length === 0) || sending) return;

    // For global Announcements tab: broadcast to ALL courses.
    // For course/DM channels: target the specific course.
    const isGlobalAnnouncement = activeChannel.type === "announcements";

    let targetCourseId: string | null = null;
    if (activeChannel.type === "course") {
      targetCourseId = activeChannel.course.id;
    } else if (activeChannel.type === "dm") {
      targetCourseId =
        (activeChannel.student as any).course_id ||
        (activeChannel.student as any).courseId ||
        (courses.length > 0 ? courses[0].id : null);
    } else {
      // Global announcements — use courses[0] as the primary for photo upload only
      targetCourseId = courses.length > 0 ? courses[0].id : null;
    }
    if (!targetCourseId && courses.length > 0) targetCourseId = courses[0].id;
    if (!targetCourseId) return;

    const studentUserId = activeChannel.type === "dm" ? getStudentUserId(activeChannel.student) : undefined;
    if (activeChannel.type === "dm" && !studentUserId) {
      toast.error("Error: Could not identify student recipient.");
      return;
    }

    const content = inputText.trim();
    const photosToUpload = [...selectedPhotos];
    setInputText("");
    setSelectedPhotos([]);
    setPhotoPreviews([]);
    setSending(true);

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
            `/api/v1/chat/${targetCourseId}/attachments/presign`,
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

    const tempId = `temp-${Date.now()}`;
    const tempMsg: BackendMessage = {
      id: tempId,
      chat_room_id: room?.id || "",
      sender_id: (user as any)?.id || "",
      ...(activeChannel.type === "dm" ? { recipient_id: studentUserId } : {}),
      content: content || (uploadedAttachments.length > 0 ? "📷 [Photo Announcement]" : ""),
      content_type: contentType,
      attachments: uploadedAttachments,
      is_pinned: false,
      is_announcement: activeChannel.type === "announcements" || (activeChannel.type === "course" && activeChannel.subType === "announcements"),
      created_at: new Date().toISOString(),
      sender: {
        id: (user as any)?.id || "",
        full_name: (user as any)?.full_name || user?.fullName || "You",
        role: "TEACHER",
      },
    };

    setMessages((prev) => [...prev, tempMsg]);
    scrollToBottom();

    try {
      const msgPayload: any = {
        content: content || (uploadedAttachments.length > 0 ? "📷 [Photo Announcement]" : ""),
        content_type: contentType,
        attachments: uploadedAttachments,
      };

      if (isGlobalAnnouncement) {
        // ── Global Announcements: broadcast to ALL courses simultaneously ──────
        // Previously only sent to courses[0], making the global tab and SA3's
        // course announcement sub-channel show IDENTICAL messages (they were
        // the same room). Now each course gets its own announcement message.
        const validCourses = courses.filter((c) => Boolean(c?.id));
        const results = await Promise.allSettled(
          validCourses.map((c) =>
            apiClient.post(`/api/v1/chat/${c.id}/messages`, {
              ...msgPayload,
              room_type: "global_announcement",
              is_announcement: true,
            })
          )
        );
        // Use the first successful response to replace the temp message
        const firstSuccess = results.find(
          (r): r is PromiseFulfilledResult<any> => r.status === "fulfilled"
        );
        const realMsg: BackendMessage | undefined = firstSuccess?.value?.data?.data;
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === tempId);
          if (realMsg) {
            if (idx !== -1) {
              const updated = [...prev];
              updated[idx] = { ...realMsg, chat_room_id: room?.id || realMsg.chat_room_id };
              return updated;
            }
            if (prev.some((m) => String(m.id).toLowerCase() === String(realMsg.id).toLowerCase()))
              return prev;

            const senderId = String(realMsg.sender?.id || (realMsg as any).sender_id || "").toLowerCase();
            const msgTime = new Date(realMsg.created_at).getTime();
            const isDup = prev.some((m) => {
              const mSenderId = String(m.sender?.id || (m as any).sender_id || "").toLowerCase();
              const mTime = new Date(m.created_at).getTime();
              const sameContent = m.content?.trim() === realMsg.content?.trim();
              const sameSender = mSenderId === senderId;
              const withinWindow = Math.abs(msgTime - mTime) < 60000;
              return sameContent && sameSender && withinWindow;
            });
            if (isDup) return prev;

            return [...prev, realMsg];
          }
          // Remove temp if all failed
          if (results.every((r) => r.status === "rejected")) {
            return prev.filter((m) => m.id !== tempId);
          }
          return prev;
        });
        if (results.every((r) => r.status === "rejected")) {
          setInputText(content);
          toast.error("Failed to send announcement.");
        }

      } else if (activeChannel.type === "dm") {
        const res = await apiClient.post(`/api/v1/chat/${targetCourseId}/messages`, {
          ...msgPayload,
          recipient_id: studentUserId,
        });
        const realMsg: BackendMessage = res?.data?.data;
        if (realMsg) {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === tempId);
            if (idx !== -1) {
              const updated = [...prev];
              updated[idx] = realMsg;
              return updated;
            }
            if (prev.some((m) => String(m.id).toLowerCase() === String(realMsg.id).toLowerCase()))
              return prev;
            return [...prev, realMsg];
          });
        }
      } else {
        // Course-specific channel (general or course announcements sub-channel)
        const isAnn = activeChannel.subType === "announcements";
        const res = await apiClient.post(`/api/v1/chat/${targetCourseId}/messages`, {
          ...msgPayload,
          room_type: isAnn ? "announcement" : "general",
          is_announcement: isAnn,
        });
        const realMsg: BackendMessage = res?.data?.data;
        if (realMsg) {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === tempId);
            if (idx !== -1) {
              const updated = [...prev];
              updated[idx] = realMsg;
              return updated;
            }
            if (prev.some((m) => String(m.id).toLowerCase() === String(realMsg.id).toLowerCase()))
              return prev;
            return [...prev, realMsg];
          });
        }
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(content);
    } finally {
      setSending(false);
    }
  };

  // ── Slow Mode Toggle ──────────────────────────────────────────────────────────
  const toggleSlowMode = async () => {
    if (!room || activeChannel.type !== "course") return;
    const newSlow = slowMode === 0 ? 10 : 0;
    setSlowMode(newSlow);
    try {
      await apiClient.patch(`/api/v1/chat/${activeChannel.course.id}/settings`, {
        slow_mode_seconds: newSlow,
      });
    } catch {
      setSlowMode(slowMode);
    }
  };

  // ── Delete Message (teacher-only) ─────────────────────────────────────────────
  const handleDeleteMessage = async (messageId: string, courseId: string) => {
    // Optimistic UI: mark as deleted immediately
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, content: "[Message deleted]", is_deleted: true }
          : m
      )
    );
    try {
      await apiClient.delete(`/api/v1/chat/${courseId}/messages/${messageId}`);
    } catch {
      // Revert optimistic update on failure
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, is_deleted: false } : m
        )
      );
      toast.error("Failed to delete message.");
    }
  };



  // ── Header info per channel ────────────────────────────────────────────────
  const channelTitle =
    activeChannel.type === "announcements"
      ? "📢 Announcements"
      : activeChannel.type === "course"
      ? `# ${activeChannel.course.title}`
      : `✉️ ${activeChannel.student.student_name}`;

  const channelSubtitle =
    activeChannel.type === "announcements"
      ? "Broadcast messages delivered to all enrolled students"
      : activeChannel.type === "course"
      ? `Course discussion — visible to all enrolled students`
      : `Private 1-on-1 with ${activeChannel.student.student_email}`;

  const inputPlaceholder =
    activeChannel.type === "announcements"
      ? "Broadcast an announcement to all students..."
      : activeChannel.type === "course"
      ? `Message #${activeChannel.course.title}...`
      : `Message ${activeChannel.student.student_name}...`;

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        background: "hsl(var(--background))",
        color: "#f1f5f9",
        overflow: "hidden",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <style>{`
        @keyframes fadeInUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        .ch-item { transition: background 0.15s, color 0.15s; }
        .ch-item:hover { background: "hsl(var(--border))" !important; }
        .st-item { transition: background 0.15s; }
        .st-item:hover { background: "hsl(var(--border))" !important; }
        .msg-input:focus { outline:none; border-color:rgba(124,58,237,0.5) !important; box-shadow: 0 0 0 3px rgba(124,58,237,0.12); }
        .send-btn:hover:not(:disabled) { filter: brightness(1.1); transform: scale(1.03); }
        .send-btn:disabled { opacity:0.45; cursor:not-allowed; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: "hsl(var(--border))"; border-radius: 4px; }
      `}</style>

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col shrink-0 overflow-y-auto bg-[#0b0f1a] border-r border-border transition-all duration-200"
        style={{
          display: (isMobile && mobileShowChat) || (!isMobile && !showChannelSidebar) ? "none" : "flex",
          width: isMobile ? "100%" : 280,
          minWidth: isMobile ? "100%" : 280,
          maxWidth: isMobile ? "100%" : 280,
        }}
      >
        {/* App Name / Branding */}
        <div
          style={{
            padding: "18px 16px 14px",
            borderBottom: "1px solid hsl(var(--border))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <GraduationCap style={{ width: 20, height: 20, color: "hsl(var(--foreground))" }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9" }}>
                SpeakArena
              </div>
              <div style={{ fontSize: 11, color: "hsl(var(--primary))", fontWeight: 600 }}>
                Instructor Hub
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 1: Announcements ─────────────────────────────────────── */}
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
          <button
            className="ch-item"
            onClick={() => {
              setActiveChannel({ type: "announcements" });
              setMobileShowChat(true);
            }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 10px",
              borderRadius: 8,
              background:
                activeChannel.type === "announcements"
                  ? "rgba(245,158,11,0.12)"
                  : "transparent",
              border:
                activeChannel.type === "announcements"
                  ? "1px solid rgba(245,158,11,0.2)"
                  : "1px solid transparent",
              color:
                activeChannel.type === "announcements" ? "#f59e0b" : "#94a3b8",
              fontWeight: activeChannel.type === "announcements" ? 700 : 400,
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
                  activeChannel.type === "announcements"
                    ? "#f59e0b"
                    : "#64748b",
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1 }}>Announcements</span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                background: "rgba(245,158,11,0.15)",
                color: "#f59e0b",
                padding: "2px 6px",
                borderRadius: 8,
                letterSpacing: "0.04em",
              }}
            >
              BROADCAST
            </span>
          </button>
        </div>

        {/* ── SECTION 2: Courses ───────────────────────────────────────────── */}
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
            Courses
            {courses.length > 0 && (
              <span
                style={{
                  marginLeft: "auto",
                  background: "rgba(124,58,237,0.2)",
                  color: "#a78bfa",
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
              ) : courses.length === 0 ? (
                <div
                  style={{
                    padding: "8px 10px",
                    fontSize: 12,
                    color: "#475569",
                    fontStyle: "italic",
                  }}
                >
                  No courses yet.
                </div>
              ) : (
                courses.map((c) => {
                  const isAnnActive =
                    activeChannel.type === "course" &&
                    activeChannel.course.id === c.id &&
                    activeChannel.subType === "announcements";
                  const isGenActive =
                    activeChannel.type === "course" &&
                    activeChannel.course.id === c.id &&
                    activeChannel.subType !== "announcements";

                  return (
                    <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 6 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#64748b",
                          padding: "6px 8px 2px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {c.title}
                      </div>

                      {/* 1. Course Announcements sub-channel */}
                      <button
                        className="ch-item"
                        onClick={() => {
                          setActiveChannel({ type: "course", course: c, subType: "announcements" });
                          setMobileShowChat(true);
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
                      </button>

                      {/* 2. Course General Talk sub-channel */}
                      <button
                        className="ch-item"
                        onClick={() => {
                          setActiveChannel({ type: "course", course: c, subType: "general" });
                          setMobileShowChat(true);
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "7px 10px 7px 16px",
                          borderRadius: 6,
                          background: isGenActive
                            ? "rgba(124,58,237,0.12)"
                            : "transparent",
                          border: isGenActive
                            ? "1px solid rgba(124,58,237,0.2)"
                            : "1px solid transparent",
                          color: isGenActive ? "#a78bfa" : "#94a3b8",
                          fontWeight: isGenActive ? 700 : 400,
                          cursor: "pointer",
                          fontSize: 12,
                          textAlign: "left",
                        }}
                      >
                        <Hash style={{ width: 14, height: 14, color: isGenActive ? "#a78bfa" : "#64748b", flexShrink: 0 }} />
                        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          General Talk
                        </span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* ── SECTION 3: DMs ───────────────────────────────────────────────── */}
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
            {allStudents.length > 0 && (
              <span
                style={{
                  marginLeft: "auto",
                  background: "rgba(14,165,233,0.15)",
                  color: "#38bdf8",
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 8,
                }}
              >
                {allStudents.length}
              </span>
            )}
          </button>

          {dmsSectionOpen && (
            <>

              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {studentsLoading ? (
                  <div
                    style={{
                      padding: "8px 10px",
                      fontSize: 12,
                      color: "#475569",
                      fontStyle: "italic",
                    }}
                  >
                    Loading students...
                  </div>
                ) : allStudents.length === 0 ? (
                  <div
                    style={{
                      padding: "8px 10px",
                      fontSize: 12,
                      color: "#475569",
                      fontStyle: "italic",
                    }}
                  >
                    No students found.
                  </div>
                ) : (
                  allStudents.map((st, idx) => {
                    const isActive =
                      activeChannel.type === "dm" &&
                      activeChannel.student.student_id === st.student_id;
                    return (
                      <button
                        key={`st-${st.student_id}-${idx}`}
                        className="st-item"
                        onClick={() => {
                          setActiveChannel({ type: "dm", student: st });
                          setMobileShowChat(true);
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
                          name={st.student_name}
                          size={28}
                          gradient={
                            isActive
                              ? "linear-gradient(135deg,#0284c7,#38bdf8)"
                              : "linear-gradient(135deg,#1e293b,#334155)"
                          }
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
                            {st.student_name}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: "#475569",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {st.student_email}
                          </div>
                        </div>
                        {isActive && (
                          <MessageSquare
                            style={{
                              width: 12,
                              height: 12,
                              color: "#38bdf8",
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Teacher Profile Footer */}
        <div
          style={{
            padding: "12px 14px",
            borderTop: "1px solid hsl(var(--border))",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(0,0,0,0.2)",
          }}
        >
          <Avatar
            name={(user as any)?.full_name || user?.fullName || "Paras (Construction)"}
            size={34}
            gradient="linear-gradient(135deg,#7c3aed,#6366f1)"
            image={(user as any)?.avatar_url || (user as any)?.avatarUrl || "/images/paras_teacher.png"}
          />
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {(user as any)?.full_name || user?.fullName || "Paras (Construction)"}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "hsl(var(--primary))",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Sparkles style={{ width: 10, height: 10 }} />
              Verified Instructor
            </div>
          </div>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#22c55e",
              flexShrink: 0,
              boxShadow: "0 0 0 2px rgba(34,197,94,0.25)",
            }}
          />
        </div>
      </div>

      {/* ── MAIN CHAT AREA ───────────────────────────────────────────────────── */}
      <div
        className="flex-1 flex-col h-full bg-background relative min-w-0"
        style={{
          display: isMobile && !mobileShowChat ? "none" : "flex",
        }}
      >
        {/* Chat Header */}
        <div
          style={{
            height: 62,
            borderBottom: "1px solid hsl(var(--border))",
            padding: "0 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(11,15,26,0.9)",
            backdropFilter: "blur(10px)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setMobileShowChat(false)}
              className="md:hidden p-2 -ml-2 rounded-lg bg-white/5 text-slate-300 hover:text-white"
              aria-label="Back to channels"
            >
              <ArrowLeft style={{ width: 18, height: 18 }} />
            </button>
            <button
              onClick={() => setShowChannelSidebar((v) => !v)}
              className="hidden md:flex p-2 rounded-lg bg-white/5 text-slate-300 hover:text-white transition-colors"
              style={{ border: "1px solid hsl(var(--border))" }}
              title={showChannelSidebar ? "Collapse channels sidebar" : "Expand channels sidebar"}
              aria-label="Toggle channels sidebar"
            >
              {showChannelSidebar ? (
                <PanelLeftClose style={{ width: 18, height: 18 }} />
              ) : (
                <PanelLeftOpen style={{ width: 18, height: 18 }} />
              )}
            </button>
            {/* Channel icon */}
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background:
                  activeChannel.type === "announcements"
                    ? "linear-gradient(135deg,#f59e0b,#d97706)"
                    : activeChannel.type === "course"
                    ? "linear-gradient(135deg,#7c3aed,#4f46e5)"
                    : "linear-gradient(135deg,#0284c7,#0ea5e9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {activeChannel.type === "announcements" && (
                <Megaphone style={{ width: 20, height: 20, color: "hsl(var(--foreground))" }} />
              )}
              {activeChannel.type === "course" && (
                <Hash style={{ width: 20, height: 20, color: "hsl(var(--foreground))" }} />
              )}
              {activeChannel.type === "dm" && (
                <MessageSquare style={{ width: 20, height: 20, color: "hsl(var(--foreground))" }} />
              )}
            </div>
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: "#f1f5f9",
                  letterSpacing: "-0.3px",
                }}
              >
                {channelTitle}
              </div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>
                {channelSubtitle}
              </div>
            </div>
          </div>

          {/* Right actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {activeChannel.type === "course" && room && (
              <button
                onClick={toggleSlowMode}
                title="Toggle Slow Mode"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 8,
                  background:
                    slowMode > 0
                      ? "rgba(239,68,68,0.12)"
                      : "hsl(var(--border))",
                  border:
                    slowMode > 0
                      ? "1px solid rgba(239,68,68,0.25)"
                      : "1px solid hsl(var(--border))",
                  color: slowMode > 0 ? "#f87171" : "#94a3b8",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {slowMode > 0 ? (
                  <Lock style={{ width: 12, height: 12 }} />
                ) : (
                  <Unlock style={{ width: 12, height: 12 }} />
                )}
                {slowMode > 0 ? `Slow (${slowMode}s)` : "Slow Mode"}
              </button>
            )}
            <button
              onClick={() => setShowInfoPanel((v) => !v)}
              style={{
                padding: 8,
                borderRadius: 8,
                background: showInfoPanel
                  ? "rgba(124,58,237,0.15)"
                  : "hsl(var(--border))",
                border: "1px solid hsl(var(--border))",
                color: showInfoPanel ? "#a78bfa" : "#94a3b8",
                cursor: "pointer",
              }}
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
            overflowY: "auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {messagesLoading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 10,
                color: "#475569",
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  border: "2px solid rgba(124,58,237,0.3)",
                  borderTop: "2px solid #7c3aed",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
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
              {activeChannel.type === "announcements" ? (
                <Megaphone style={{ width: 44, height: 44, opacity: 0.25, color: "#f59e0b" }} />
              ) : activeChannel.type === "course" ? (
                <Hash style={{ width: 44, height: 44, opacity: 0.2, color: "#a78bfa" }} />
              ) : (
                <MessageSquare style={{ width: 44, height: 44, opacity: 0.2, color: "#38bdf8" }} />
              )}
              <div style={{ fontSize: 15, fontWeight: 700, color: "#475569" }}>
                No messages yet
              </div>
              <div style={{ fontSize: 12, color: "#334155", textAlign: "center", maxWidth: 280 }}>
                {activeChannel.type === "announcements"
                  ? "Post an announcement to notify all your students instantly."
                  : activeChannel.type === "course"
                  ? "Be the first to say something in this course channel."
                  : `Start a private conversation with ${activeChannel.student.student_name}.`}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const senderId = String(msg.sender?.id || msg.sender_id || "").toLowerCase();
              const myId = String((user as any)?.id || "").toLowerCase();
              const isMine = senderId === myId;
              const senderName = isMine
                ? "You"
                : msg.sender?.full_name || (msg.sender as any)?.name || "Student";
              const isDeleted = Boolean(msg.is_deleted);
              const isFirstUnread = firstUnreadMessageId === msg.id;

              // Determine which courseId this message belongs to for the delete call
              const msgCourseId =
                activeChannel.type === "course"
                  ? activeChannel.course.id
                  : activeChannel.type === "dm"
                  ? (activeChannel.student as any).course_id ||
                    (activeChannel.student as any).courseId ||
                    (courses.length > 0 ? courses[0].id : "")
                  : courses.length > 0
                  ? courses[0].id
                  : "";

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
                      <div style={{ flex: 1, height: 1, background: "rgba(124,58,237,0.35)" }} />
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          padding: "3px 12px",
                          borderRadius: 20,
                          background: "rgba(124,58,237,0.18)",
                          color: "#c4b5fd",
                          border: "1px solid rgba(124,58,237,0.35)",
                          boxShadow: "0 2px 8px rgba(124,58,237,0.2)",
                        }}
                      >
                        Unread Messages
                      </span>
                      <div style={{ flex: 1, height: 1, background: "rgba(124,58,237,0.35)" }} />
                    </div>
                  )}
                  <div
                    id={`msg-${msg.id}`}
                    className="msg-group"
                    style={{
                      display: "flex",
                      flexDirection: isMine ? "row-reverse" : "row",
                      alignItems: "flex-start",
                      gap: 11,
                      animation: "fadeInUp 0.2s ease",
                      position: "relative",
                    }}
                    onMouseEnter={(e) => {
                      const btn = (e.currentTarget as HTMLElement).querySelector(".msg-delete-btn") as HTMLElement | null;
                      if (btn) btn.style.opacity = "1";
                    }}
                    onMouseLeave={(e) => {
                      const btn = (e.currentTarget as HTMLElement).querySelector(".msg-delete-btn") as HTMLElement | null;
                      if (btn) btn.style.opacity = "0";
                    }}
                  >
                  <Avatar
                    name={senderName}
                    size={32}
                    gradient={
                      isMine
                        ? "linear-gradient(135deg,#7c3aed,#4f46e5)"
                        : "linear-gradient(135deg,#1e293b,#334155)"
                    }
                  />
                  <div
                    style={{
                      maxWidth: "82%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isMine ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                        flexDirection: isMine ? "row-reverse" : "row",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: isMine ? "#a78bfa" : "#94a3b8",
                        }}
                      >
                        {senderName}
                      </span>
                      {msg.is_announcement && (
                        <span
                          style={{
                            fontSize: 9,
                            background: "rgba(245,158,11,0.2)",
                            color: "#f59e0b",
                            padding: "2px 6px",
                            borderRadius: 6,
                            fontWeight: 700,
                            letterSpacing: "0.03em",
                          }}
                        >
                          ANNOUNCEMENT
                        </span>
                      )}
                      <span style={{ fontSize: 10, color: "#334155" }}>
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: isMine
                          ? "14px 2px 14px 14px"
                          : "2px 14px 14px 14px",
                        background: isDeleted
                          ? "rgba(71,85,105,0.12)"
                          : msg.is_announcement
                          ? "rgba(245,158,11,0.08)"
                          : isMine
                          ? "hsl(var(--primary))"
                          : "hsl(var(--border))",
                        border: isDeleted
                          ? "1px solid rgba(71,85,105,0.25)"
                          : msg.is_announcement
                          ? "1px solid rgba(245,158,11,0.2)"
                          : isMine
                          ? "none"
                          : "1px solid hsl(var(--border))",
                        color: isDeleted ? "#64748b" : "#f0f4f8",
                        fontSize: isDeleted ? 12 : 13,
                        fontStyle: isDeleted ? "italic" : "normal",
                        lineHeight: 1.55,
                        wordBreak: "break-word",
                        boxShadow: isMine
                          ? "0 4px 12px rgba(124,58,237,0.2)"
                          : "0 2px 8px rgba(0,0,0,0.15)",
                      }}
                    >
                      {msg.content}

                      {/* Photo attachments — hidden for deleted messages */}
                      {!isDeleted && msg.attachments && msg.attachments.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            marginTop: msg.content ? 8 : 0,
                          }}
                        >
                          {msg.attachments.map((att: any, idx: number) => {
                            const rawUrl = att.url || att.r2_key || "";
                            const photoSrc =
                              rawUrl.startsWith("http://") || rawUrl.startsWith("https://") || rawUrl.startsWith("data:")
                                ? rawUrl
                                : `https://pub-24a225d578474f4fb5b75f2a90813a11.r2.dev/${rawUrl.replace(/^\//, "")}`;
                            return (
                              <div
                                key={idx}
                                style={{
                                  borderRadius: 8,
                                  overflow: "hidden",
                                  border: "1px solid rgba(255,255,255,0.15)",
                                }}
                              >
                                <img
                                  src={photoSrc}
                                  alt={att.file_name || "Announcement photo"}
                                  style={{
                                    maxWidth: 280,
                                    maxHeight: 220,
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

                      {/* Direct image in content if attachments is empty */}
                      {!isDeleted && (!msg.attachments || msg.attachments.length === 0) && (msg.content_type === "image" || /\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i.test(msg.content.trim()) || msg.content.trim().startsWith("data:image/")) && (
                        <div style={{ marginTop: 8, borderRadius: 8, overflow: "hidden" }}>
                          <img
                            src={msg.content.trim().startsWith("http") || msg.content.trim().startsWith("data:") ? msg.content.trim() : `https://pub-24a225d578474f4fb5b75f2a90813a11.r2.dev/${msg.content.trim().replace(/^\//, "")}`}
                            alt="Photo"
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
                  </div>

                  {/* Delete button — teacher only, hidden until hover, not shown on already-deleted messages */}
                  {!isDeleted && !msg.id.startsWith("temp-") && msgCourseId && (
                    <button
                      className="msg-delete-btn"
                      title="Delete message"
                      onClick={() => handleDeleteMessage(msg.id, msgCourseId)}
                      style={{
                        opacity: 0,
                        transition: "opacity 0.15s",
                        position: "absolute",
                        top: 0,
                        right: isMine ? "auto" : 4,
                        left: isMine ? 4 : "auto",
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: "rgba(239,68,68,0.12)",
                        border: "1px solid rgba(239,68,68,0.25)",
                        color: "#f87171",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                  )}
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          style={{
            padding: "14px 20px",
            paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))",
            borderTop: "1px solid hsl(var(--border))",
            background: "rgba(11,15,26,0.8)",
            backdropFilter: "blur(10px)",
            flexShrink: 0,
          }}
        >
          {/* Photo Previews Bar */}
          {photoPreviews.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 10,
                padding: "8px 12px",
                background: "rgba(255,255,255,0.04)",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                overflowX: "auto",
              }}
            >
              {photoPreviews.map((preview, i) => (
                <div
                  key={i}
                  style={{
                    position: "relative",
                    width: 50,
                    height: 50,
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.2)",
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={preview}
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
                      background: "rgba(0,0,0,0.7)",
                      color: "#fff",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      fontSize: 10,
                    }}
                  >
                    <X style={{ width: 10, height: 10 }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="hidden sm:block">
              <Avatar
                name={(user as any)?.full_name || user?.fullName || "T"}
                size={34}
                gradient="linear-gradient(135deg,#7c3aed,#4f46e5)"
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
              title="Attach photos"
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "hsl(var(--border))",
                border: "1px solid hsl(var(--border))",
                color: selectedPhotos.length > 0 ? "#f59e0b" : "#94a3b8",
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
              type="text"
              className="msg-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                selectedPhotos.length > 0
                  ? `Add a caption for ${selectedPhotos.length} photo(s)...`
                  : inputPlaceholder
              }
              style={{
                flex: 1,
                minWidth: 0,
                background: "hsl(var(--border))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 12,
                padding: "11px 14px",
                color: "hsl(var(--foreground))",
                fontSize: 16,
                outline: "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
            />

            <button
              type="submit"
              className="send-btn"
              disabled={(!inputText.trim() && selectedPhotos.length === 0) || sending}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "11px 16px",
                borderRadius: 12,
                background:
                  activeChannel.type === "announcements" || (activeChannel.type === "course" && activeChannel.subType === "announcements")
                    ? "linear-gradient(135deg,#d97706,#f59e0b)"
                    : activeChannel.type === "dm"
                    ? "linear-gradient(135deg,#0284c7,#0ea5e9)"
                    : "linear-gradient(135deg,#7c3aed,#4f46e5)",
                color: "hsl(var(--foreground))",
                border: "none",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                flexShrink: 0,
                transition: "filter 0.15s, transform 0.15s",
              }}
            >
              <Send style={{ width: 16, height: 16 }} />
              <span className="hidden sm:inline">
                {activeChannel.type === "announcements" || (activeChannel.type === "course" && activeChannel.subType === "announcements")
                  ? "Broadcast"
                  : "Send"}
              </span>
            </button>
          </div>
        </form>
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
              borderLeft: "1px solid hsl(var(--border))",
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

          {activeChannel.type === "announcements" && (
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
                Broadcast Channel
              </div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
                Messages here are delivered to <strong style={{ color: "#94a3b8" }}>all enrolled students</strong> across every course.
              </div>
            </div>
          )}

          {activeChannel.type === "course" && (
            <>
              <div
                style={{
                  background: "rgba(124,58,237,0.06)",
                  border: "1px solid rgba(124,58,237,0.15)",
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div
                  style={{ fontWeight: 700, fontSize: 14, color: "#a78bfa", marginBottom: 4 }}
                >
                  {activeChannel.course.title}
                </div>
                <div style={{ fontSize: 11, color: "#475569" }}>
                  Level: {activeChannel.course.level || "Standard"}
                </div>
                {activeChannel.course.total_enrollments !== undefined && (
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: "#94a3b8",
                    }}
                  >
                    <Users style={{ width: 14, height: 14, color: "#a78bfa" }} />
                    {activeChannel.course.total_enrollments} students enrolled
                  </div>
                )}
              </div>

              <div
                style={{
                  background: "hsl(var(--border))",
                  border: "1px solid hsl(var(--border))",
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
                  Room Settings
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#cbd5e1", marginBottom: 6 }}>
                  <span>Slow Mode</span>
                  <span style={{ color: slowMode > 0 ? "#f87171" : "#34d399", fontWeight: 600 }}>
                    {slowMode > 0 ? `${slowMode}s` : "Off"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#cbd5e1" }}>
                  <span>Socket</span>
                  <span style={{ color: "#34d399", fontWeight: 600 }}>Connected</span>
                </div>
              </div>
            </>
          )}

          {activeChannel.type === "dm" && (
            <div
              style={{
                background: "rgba(14,165,233,0.06)",
                border: "1px solid rgba(14,165,233,0.15)",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <Avatar
                name={activeChannel.student.student_name}
                size={44}
                gradient="linear-gradient(135deg,#0284c7,#0ea5e9)"
              />
              <div
                style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0", marginTop: 10 }}
              >
                {activeChannel.student.student_name}
              </div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                {activeChannel.student.student_email}
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: "#38bdf8",
                  fontWeight: 600,
                }}
              >
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#22c55e",
                  }}
                />
                Private DM Channel
              </div>
            </div>
          )}

          {/* Stats summary */}
          <div
            style={{
              background: "hsl(var(--border))",
              border: "1px solid hsl(var(--border))",
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
              Platform Stats
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94a3b8" }}>
                <span>My Courses</span>
                <span style={{ fontWeight: 700, color: "#a78bfa" }}>{courses.length}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94a3b8" }}>
                <span>Total Students</span>
                <span style={{ fontWeight: 700, color: "#38bdf8" }}>{allStudents.length}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94a3b8" }}>
                <span>Messages Loaded</span>
                <span style={{ fontWeight: 700, color: "#34d399" }}>{messages.length}</span>
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
