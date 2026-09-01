"use client";

import * as React from "react";
import Link from "next/link";
import {
  Video,
  FileText,
  Calendar,
  Clock,
  CheckCheck,
  Sparkles,
  ExternalLink,
  BookOpen,
  Bell,
  RefreshCw,
  PlayCircle,
  CheckCircle2,
} from "lucide-react";
import { apiClient } from "@/services/api/client";
import { formatDistanceToNow, parseISO, format } from "date-fns";
import { toast } from "sonner";

export interface UnifiedNotificationItem {
  id: string;
  category: "meeting" | "resource";
  type: string;
  title: string;
  body: string;
  courseTitle?: string;
  teacherName?: string;
  actionUrl: string;
  isRead: boolean;
  createdAt: string;
  meetingStartTime?: string;
  meetingEndTime?: string;
  meetingStatus?: "live" | "upcoming" | "ended";
  resourceType?: "video" | "pdf";
}

export function NotificationsDashboard() {
  const [items, setItems] = React.useState<UnifiedNotificationItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<"all" | "meetings" | "resources">("all");
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [markingAll, setMarkingAll] = React.useState(false);

  const fetchUnifiedNotifications = React.useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch persistent in-app notifications
      let backendNotifs: any[] = [];
      try {
        const notifRes = await apiClient.get("/api/v1/notifications", {
          params: { page: 1, page_size: 50 },
        });
        const raw = notifRes.data;
        if (Array.isArray(raw?.data)) backendNotifs = raw.data;
        else if (Array.isArray(raw?.data?.items)) backendNotifs = raw.data.items;
        else if (Array.isArray(raw?.items)) backendNotifs = raw.items;
        else if (Array.isArray(raw)) backendNotifs = raw;
      } catch {
        // Continue with fallback endpoints
      }

      // 2. Fetch scheduled meetings / live classes
      let meetingsList: any[] = [];
      try {
        const meetingRes = await apiClient.get("/api/v1/meetings", {
          params: { page: 1, page_size: 30 },
        });
        const mRaw = meetingRes.data;
        if (Array.isArray(mRaw?.data)) meetingsList = mRaw.data;
        else if (Array.isArray(mRaw?.data?.items)) meetingsList = mRaw.data.items;
        else if (Array.isArray(mRaw?.items)) meetingsList = mRaw.items;
        else if (Array.isArray(mRaw)) meetingsList = mRaw;
      } catch {
        // ignore
      }

      const unified: UnifiedNotificationItem[] = [];
      const seenIds = new Set<string>();

      // Filter and normalize backend notifications for resources and meetings
      backendNotifs.forEach((n: any) => {
        const nType = String(n.type || n.notification_type || "").toLowerCase();
        const eType = String(n.entity_type || "").toLowerCase();
        const title = n.title || "";
        const body = n.body || n.message || "";

        const isResource =
          nType.includes("resource") ||
          eType === "video" ||
          eType === "pdf" ||
          eType === "resource" ||
          title.toLowerCase().includes("resource") ||
          title.toLowerCase().includes("material") ||
          title.toLowerCase().includes("pdf") ||
          title.toLowerCase().includes("video");

        const isMeeting =
          nType.includes("meeting") ||
          nType.includes("live") ||
          eType === "meeting" ||
          eType === "live_class" ||
          title.toLowerCase().includes("meeting") ||
          title.toLowerCase().includes("class") ||
          title.toLowerCase().includes("session") ||
          body.toLowerCase().includes("scheduled");

        if (isResource) {
          const id = String(n.id || `notif-res-${title}`);
          if (!seenIds.has(id)) {
            seenIds.add(id);
            unified.push({
              id,
              category: "resource",
              type: nType || "resource_uploaded",
              title: title || "New Learning Material Added",
              body: body || "A new resource is available for your course.",
              courseTitle: n.metadata?.course_title || n.course_title || "Course Material",
              teacherName: n.metadata?.teacher_name || n.actor_name || "Instructor",
              actionUrl: n.action_url || "/student/resources",
              isRead: Boolean(n.is_read || n.isRead),
              createdAt: n.created_at || n.createdAt || new Date().toISOString(),
              resourceType: eType === "video" || title.toLowerCase().includes("video") ? "video" : "pdf",
            });
          }
        } else if (isMeeting) {
          const id = String(n.id || `notif-meet-${title}`);
          if (!seenIds.has(id)) {
            seenIds.add(id);
            unified.push({
              id,
              category: "meeting",
              type: nType || "meeting_scheduled",
              title: title || "Live Class Scheduled",
              body: body || "A live class session has been scheduled.",
              courseTitle: n.metadata?.course_title || n.course_title || "Live Class",
              teacherName: n.metadata?.teacher_name || n.actor_name || "Paras (Construction)",
              actionUrl: n.action_url || "/student/live",
              isRead: Boolean(n.is_read || n.isRead),
              createdAt: n.created_at || n.createdAt || new Date().toISOString(),
              meetingStartTime: n.metadata?.start_time || n.start_time,
              meetingEndTime: n.metadata?.end_time || n.end_time,
              meetingStatus: "upcoming",
            });
          }
        }
      });

      // Augment with upcoming/active meetings
      const now = new Date();
      meetingsList.forEach((m: any) => {
        const mId = `meeting-${m.id || m.meeting_id}`;
        if (!seenIds.has(mId)) {
          seenIds.add(mId);
          const startIso = m.start_time || m.scheduled_at || m.start_at || m.created_at;
          const endIso = m.end_time || m.end_at;
          const startTime = startIso ? new Date(startIso) : new Date();
          const endTime = endIso ? new Date(endIso) : new Date(startTime.getTime() + 60 * 60 * 1000);

          let status: "live" | "upcoming" | "ended" = "upcoming";
          if (m.status === "in_progress" || m.status === "live" || (now >= startTime && now <= endTime)) {
            status = "live";
          } else if (now > endTime) {
            status = "ended";
          }

          if (status !== "ended") {
            unified.push({
              id: mId,
              category: "meeting",
              type: "meeting_scheduled",
              title: m.title || m.topic || "Scheduled Live Class",
              body: m.description || `Upcoming live class session for ${m.course_title || m.course?.title || "your course"}.`,
              courseTitle: m.course_title || m.course?.title || "Enrolled Course",
              teacherName: m.teacher_name || m.instructor_name || m.host_name || "Paras (Construction)",
              actionUrl: "/student/live",
              isRead: status !== "live",
              createdAt: m.created_at || startIso || new Date().toISOString(),
              meetingStartTime: startIso,
              meetingEndTime: endIso,
              meetingStatus: status,
            });
          }
        }
      });

      // Sort newest first
      unified.sort((a, b) => {
        const timeA = new Date(a.meetingStartTime || a.createdAt).getTime();
        const timeB = new Date(b.meetingStartTime || b.createdAt).getTime();
        return timeB - timeA;
      });

      setItems(unified);
    } catch {
      toast.error("Could not refresh notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchUnifiedNotifications();
  }, [fetchUnifiedNotifications]);

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await apiClient.post("/api/v1/notifications/read-all").catch(() => {});
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      toast.success("All notifications marked as read");
    } catch {
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } finally {
      setMarkingAll(false);
    }
  };

  const handleMarkItemRead = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (!id.startsWith("meeting-")) {
        await apiClient.post(`/api/v1/notifications/${id}/read`).catch(() => {});
      }
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    } catch {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    }
  };

  const filteredItems = items.filter((item) => {
    if (activeTab === "meetings" && item.category !== "meeting") return false;
    if (activeTab === "resources" && item.category !== "resource") return false;
    if (unreadOnly && item.isRead) return false;
    return true;
  });

  const totalUnreadCount = items.filter((i) => !i.isRead).length;
  const meetingsCount = items.filter((i) => i.category === "meeting").length;
  const resourcesCount = items.filter((i) => i.category === "resource").length;

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-background text-foreground py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Page Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(59,130,246,0.2) 100%)",
                border: "1px solid rgba(99,102,241,0.3)",
              }}
            >
              <Bell className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Notifications</h1>
                {totalUnreadCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {totalUnreadCount} new
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Updates on scheduled live meetings and newly uploaded learning resources.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchUnifiedNotifications}
              disabled={loading}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-border/60 transition-colors"
              title="Refresh notifications"
              aria-label="Refresh notifications"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {totalUnreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all as read
              </button>
            )}
          </div>
        </div>

        {/* ── Filter Tabs & Options ────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-border/60 overflow-x-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === "all"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              All Updates ({items.length})
            </button>
            <button
              onClick={() => setActiveTab("meetings")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === "meetings"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              Scheduled Meetings ({meetingsCount})
            </button>
            <button
              onClick={() => setActiveTab("resources")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === "resources"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              New Resources ({resourcesCount})
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
            />
            Show unread only
          </label>
        </div>

        {/* ── Notification Feed ─────────────────────────────────────────────────── */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
            <p className="text-sm font-medium">Loading your updates...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 px-6 text-center rounded-2xl bg-slate-900/40 border border-border/50 flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              {unreadOnly
                ? "No unread updates"
                : activeTab === "meetings"
                ? "No scheduled meetings found"
                : activeTab === "resources"
                ? "No new resources added yet"
                : "No notifications right now"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-sm mb-6">
              {unreadOnly
                ? "You are completely caught up with all live classes and course materials."
                : "When your instructors schedule live sessions or upload PDFs and videos, they will appear here."}
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/student/live"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                View Live Classes
              </Link>
              <Link
                href="/student/resources"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 transition-colors"
              >
                Browse Resources
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredItems.map((item) => {
              const isMeeting = item.category === "meeting";
              const isLive = item.meetingStatus === "live";

              return (
                <div
                  key={item.id}
                  className={`group relative rounded-2xl p-4 sm:p-5 transition-all duration-200 border ${
                    isMeeting
                      ? isLive
                        ? "bg-blue-950/25 border-blue-500/50 shadow-lg shadow-blue-500/10"
                        : "bg-slate-900/70 hover:bg-slate-900 border-blue-500/20 hover:border-blue-500/40"
                      : "bg-slate-900/70 hover:bg-slate-900 border-purple-500/20 hover:border-purple-500/40"
                  } ${!item.isRead ? "ring-1 ring-indigo-500/30" : "opacity-95"}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Left Icon Badge */}
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isMeeting
                          ? isLive
                            ? "bg-blue-500 text-white animate-pulse"
                            : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                          : "bg-violet-500/15 text-violet-400 border border-violet-500/30"
                      }`}
                    >
                      {isMeeting ? (
                        <Video className="w-5 h-5" />
                      ) : item.resourceType === "video" ? (
                        <PlayCircle className="w-5 h-5" />
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {/* Type Pill */}
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            isMeeting
                              ? isLive
                                ? "bg-blue-500/30 text-blue-300 border-blue-400/50 font-black"
                                : "bg-blue-500/10 text-blue-400 border-blue-500/25"
                              : "bg-violet-500/10 text-violet-300 border-violet-500/25"
                          }`}
                        >
                          {isMeeting
                            ? isLive
                              ? "● LIVE NOW"
                              : "Live Class Scheduled"
                            : item.resourceType === "video"
                            ? "Video Lesson"
                            : "PDF Resource"}
                        </span>

                        {item.courseTitle && (
                          <span className="text-xs text-slate-400 flex items-center gap-1 font-medium truncate max-w-[220px]">
                            <BookOpen className="w-3 h-3 text-slate-500 flex-shrink-0" />
                            {item.courseTitle}
                          </span>
                        )}

                        <span className="text-[11px] text-slate-500 ml-auto flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true })}
                        </span>
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-white mb-1 group-hover:text-indigo-200 transition-colors">
                        {item.title}
                      </h3>

                      <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 mb-3">
                        {item.body}
                      </p>

                      {/* Meeting timing info if available */}
                      {isMeeting && item.meetingStartTime && (
                        <div className="flex items-center gap-2 text-xs text-blue-300/90 bg-blue-950/40 border border-blue-500/20 rounded-lg px-3 py-1.5 mb-3 w-fit">
                          <Calendar className="w-3.5 h-3.5 text-blue-400" />
                          <span>
                            {format(parseISO(item.meetingStartTime), "EEEE, MMM d, yyyy • h:mm a")}
                          </span>
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="flex items-center gap-3 pt-1">
                        <Link
                          href={item.actionUrl}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            isMeeting
                              ? "bg-blue-600 hover:bg-blue-500 text-white shadow-sm hover:shadow-blue-500/20"
                              : "bg-violet-600 hover:bg-violet-500 text-white shadow-sm hover:shadow-violet-500/20"
                          }`}
                        >
                          {isMeeting ? (
                            <>
                              <Video className="w-3.5 h-3.5" />
                              {isLive ? "Join Class Now" : "View Meeting Details"}
                            </>
                          ) : (
                            <>
                              <ExternalLink className="w-3.5 h-3.5" />
                              Open Resource
                            </>
                          )}
                        </Link>

                        {!item.isRead && (
                          <button
                            onClick={(e) => handleMarkItemRead(item.id, e)}
                            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-300 font-medium transition-colors"
                            title="Mark as read"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

