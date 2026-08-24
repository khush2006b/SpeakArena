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
  Search,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  ArrowLeft,
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
  | { type: "course"; course: TeacherCourse }
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
}: {
  name?: string | null;
  size?: number;
  gradient?: string;
}) {
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
  const [studentSearchQuery, setStudentSearchQuery] = useState("");

  // Active channel selection
  const [activeChannel, setActiveChannel] = useState<ActiveChannel>({
    type: "announcements",
  });

  // Room (loaded per selected course)
  const [room, setRoom] = useState<ChatRoomData | null>(null);

  // Section collapse state
  const [coursesSectionOpen, setCoursesSectionOpen] = useState(true);
  const [dmsSectionOpen, setDmsSectionOpen] = useState(true);
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

  // Messages
  const [messages, setMessages] = useState<BackendMessage[]>([]);
  const [inputText, setInputText] = useState("");

  // Loading
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // UI
  const [slowMode, setSlowMode] = useState<number>(0);
  const [showInfoPanel, setShowInfoPanel] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);

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
      setMessages([]);
      setRoom(null);
      apiClient
        .get(`/api/v1/chat/${course.id}`)
        .then((res: any) => {
          const r: ChatRoomData = res.data?.data;
          setRoom(r);
          setSlowMode(r?.slow_mode_seconds ?? 0);
        })
        .catch(() => {});
    } else if (courses.length > 0) {
      // For announcements & DMs: use first course room for WS context
      setMessages([]);
      setRoom(null);
      apiClient
        .get(`/api/v1/chat/${courses[0].id}`)
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

      // Room guard for course discussion / announcement channels
      if (currentRoom?.id && msg.chat_room_id && ch?.type !== "dm") {
        if (
          String(msg.chat_room_id).toLowerCase() !==
          String(currentRoom.id).toLowerCase()
        )
          return;
      }

      if (ch?.type === "announcements") {
        if (!msg.is_announcement) return;
      } else if (ch?.type === "course") {
        if (msg.is_announcement || msg.recipient_id) return;
      }

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
    },
    [scrollToBottom]
  );

  // ── Fetch Message History ────────────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    if (activeChannel.type === "dm" && !activeChannel.student) {
      setMessages([]);
      return;
    }
    if (courses.length === 0) return;

    setMessagesLoading(true);

    try {
      if (activeChannel.type === "course") {
        // Single course discussion
        const url = `/api/v1/chat/${activeChannel.course.id}/messages?limit=50&public_only=true`;
        const res = await apiClient.get(url);
        let msgs: BackendMessage[] = res.data?.data?.messages ?? [];
        msgs = msgs.filter((m) => !m.is_announcement && !m.recipient_id);
        setMessages([...msgs].reverse());

      } else if (activeChannel.type === "announcements") {
        // Collect announcements across ALL teacher courses
        const results = await Promise.all(
          courses.map((c) =>
            apiClient
              .get(`/api/v1/chat/${c.id}/messages?limit=50&announcements_only=true`)
              .then((res: any) => (res.data?.data?.messages ?? []) as BackendMessage[])
              .catch(() => [] as BackendMessage[])
          )
        );
        // Merge, filter, de-dup by id, sort oldest-first
        const allMsgs = results.flat().filter((m) => m.is_announcement);
        const seen = new Set<string>();
        const unique = allMsgs.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        unique.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        setMessages(unique);

      } else if (activeChannel.type === "dm") {
        // Collect DM threads across ALL teacher courses for this student
        const studentId = getStudentUserId(activeChannel.student);
        if (!studentId) {
          setMessages([]);
          setMessagesLoading(false);
          return;
        }
        const results = await Promise.all(
          courses.map((c) =>
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
        setMessages(unique);
      }

      scrollToBottom();
    } catch {
      // keep empty
    } finally {
      setMessagesLoading(false);
    }
  }, [activeChannel, courses, scrollToBottom]);

  useEffect(() => {
    setMessages([]);
    fetchMessages();
  }, [fetchMessages]);

  // ── WebSocket connection ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!room?.id) return;
    connectChatSocket(room.id);
    const socket = getChatSocket(room.id);
    const onMessageNew = (payload: any) => {
      const incoming: BackendMessage = payload?.message || payload;
      if (incoming && incoming.content) safeAppendMessage(incoming);
    };
    socket.on(socketEvents.chat.MESSAGE_RECEIVED, onMessageNew);
    return () => {
      socket.off(socketEvents.chat.MESSAGE_RECEIVED, onMessageNew);
      disconnectChatSocket(room.id);
    };
  }, [room?.id, safeAppendMessage]);

  // ── Send Message ─────────────────────────────────────────────────────────────
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending) return;

    // Determine target course
    let targetCourseId: string | null = null;
    if (activeChannel.type === "course") {
      targetCourseId = activeChannel.course.id;
    } else if (activeChannel.type === "dm") {
      targetCourseId =
        (activeChannel.student as any).course_id ||
        (activeChannel.student as any).courseId ||
        (courses.length > 0 ? courses[0].id : null);
    } else if (courses.length > 0) {
      targetCourseId = courses[0].id;
    }
    if (!targetCourseId && courses.length > 0) {
      targetCourseId = courses[0].id;
    }
    if (!targetCourseId) return;

    const studentUserId = activeChannel.type === "dm" ? getStudentUserId(activeChannel.student) : undefined;
    if (activeChannel.type === "dm" && !studentUserId) {
      toast.error("Error: Could not identify student recipient.");
      return;
    }

    const content = inputText.trim();
    setInputText("");
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const tempMsg: BackendMessage = {
      id: tempId,
      chat_room_id: room?.id || "",
      sender_id: (user as any)?.id || "",
      ...(activeChannel.type === "dm" ? { recipient_id: studentUserId } : {}),
      content,
      content_type: "text",
      is_pinned: false,
      is_announcement: activeChannel.type === "announcements",
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
      let res: any = null;
      if (activeChannel.type === "announcements") {
        // Broadcast to ALL teacher courses simultaneously
        const results = await Promise.all(
          courses.map((c) =>
            apiClient
              .post(`/api/v1/chat/${c.id}/announcements`, { content, pin: false })
              .catch(() => null)
          )
        );
        res = results.find((r) => r !== null) || null;
      } else if (activeChannel.type === "dm") {
        res = await apiClient.post(`/api/v1/chat/${targetCourseId}/messages`, {
          content,
          content_type: "text",
          recipient_id: studentUserId,
        });
      } else {
        res = await apiClient.post(`/api/v1/chat/${targetCourseId}/messages`, {
          content,
          content_type: "text",
        });
      }

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
        className="flex flex-col shrink-0 overflow-y-auto bg-[#0b0f1a] border-r border-border"
        style={{
          display: isMobile && mobileShowChat ? "none" : "flex",
          width: isMobile ? "100%" : 320,
          minWidth: isMobile ? "100%" : 320,
          maxWidth: isMobile ? "100%" : 320,
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
                  const isActive =
                    activeChannel.type === "course" &&
                    activeChannel.course.id === c.id;
                  return (
                    <button
                      key={c.id}
                      className="ch-item"
                      onClick={() => {
                        setActiveChannel({ type: "course", course: c });
                        setMobileShowChat(true);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "9px 10px",
                        borderRadius: 8,
                        background: isActive
                          ? "rgba(124,58,237,0.12)"
                          : "transparent",
                        border: isActive
                          ? "1px solid rgba(124,58,237,0.2)"
                          : "1px solid transparent",
                        color: isActive ? "#a78bfa" : "#94a3b8",
                        fontWeight: isActive ? 700 : 400,
                        cursor: "pointer",
                        fontSize: 13,
                        textAlign: "left",
                      }}
                    >
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 7,
                          background: isActive
                            ? "linear-gradient(135deg,#7c3aed,#4f46e5)"
                            : "hsl(var(--border))",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: 800,
                          color: isActive ? "hsl(var(--foreground))" : "#64748b",
                          flexShrink: 0,
                          letterSpacing: "-0.5px",
                        }}
                      >
                        {c.title.slice(0, 2).toUpperCase()}
                      </div>
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
                            color: isActive ? "#f1f5f9" : "#cbd5e1",
                            fontWeight: isActive ? 700 : 500,
                            fontSize: 13,
                          }}
                        >
                          {c.title}
                        </div>
                        {c.level && (
                          <div style={{ fontSize: 10, color: "#475569" }}>
                            {c.level}
                            {c.total_enrollments !== undefined &&
                              ` · ${c.total_enrollments} students`}
                          </div>
                        )}
                      </div>
                      <Hash
                        style={{
                          width: 12,
                          height: 12,
                          color: isActive ? "#a78bfa" : "#334155",
                          flexShrink: 0,
                        }}
                      />
                    </button>
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
              {/* Student Search */}
              <div style={{ position: "relative", marginBottom: 6 }}>
                <Search
                  style={{
                    width: 12,
                    height: 12,
                    color: "#475569",
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                />
                <input
                  type="text"
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  placeholder="Search students..."
                  style={{
                    width: "100%",
                    background: "hsl(var(--border))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    padding: "7px 10px 7px 28px",
                    fontSize: 16,
                    color: "#f1f5f9",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

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
            name={(user as any)?.full_name || user?.fullName || "Teacher"}
            size={34}
            gradient="linear-gradient(135deg,#7c3aed,#6366f1)"
          />
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {(user as any)?.full_name || user?.fullName || "Instructor"}
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

              return (
                <div
                  key={msg.id || `msg-${idx}`}
                  style={{
                    display: "flex",
                    flexDirection: isMine ? "row-reverse" : "row",
                    alignItems: "flex-start",
                    gap: 11,
                    animation: "fadeInUp 0.2s ease",
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
                      maxWidth: "68%",
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
                        background: msg.is_announcement
                          ? "rgba(245,158,11,0.08)"
                          : isMine
                          ? "hsl(var(--primary))"
                          : "hsl(var(--border))",
                        border: msg.is_announcement
                          ? "1px solid rgba(245,158,11,0.2)"
                          : isMine
                          ? "none"
                          : "1px solid hsl(var(--border))",
                        color: "#f0f4f8",
                        fontSize: 13,
                        lineHeight: 1.55,
                        wordBreak: "break-word",
                        boxShadow: isMine
                          ? "0 4px 12px rgba(124,58,237,0.2)"
                          : "0 2px 8px rgba(0,0,0,0.15)",
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
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
            borderTop: "1px solid hsl(var(--border))",
            background: "rgba(11,15,26,0.8)",
            backdropFilter: "blur(10px)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar
              name={(user as any)?.full_name || user?.fullName || "T"}
              size={34}
              gradient="linear-gradient(135deg,#7c3aed,#4f46e5)"
            />
            <input
              type="text"
              className="msg-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={inputPlaceholder}
              style={{
                flex: 1,
                background: "hsl(var(--border))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 12,
                padding: "11px 16px",
                color: "hsl(var(--foreground))",
                fontSize: 16,
                outline: "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
            />
            <button
              type="submit"
              className="send-btn"
              disabled={!inputText.trim() || sending}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "11px 20px",
                borderRadius: 12,
                background:
                  activeChannel.type === "announcements"
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
              <Send style={{ width: 15, height: 15 }} />
              {activeChannel.type === "announcements" ? "Broadcast" : "Send"}
            </button>
          </div>
        </form>
      </div>

      {/* ── RIGHT INFO PANEL ─────────────────────────────────────────────────── */}
      {showInfoPanel && (
        <div
          className="hidden md:flex"
          style={{
            width: 270,
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
              fontSize: 11,
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Channel Info
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
      )}
    </div>
  );
}
