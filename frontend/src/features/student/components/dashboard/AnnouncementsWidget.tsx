"use client";

import * as React from "react";
import { Megaphone, Pin, ChevronRight, MessageSquare, BookOpen, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { apiClient } from "@/services/api/client";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, parseISO } from "date-fns";

export interface AnnouncementItem {
  id: string;
  courseId: string;
  courseTitle?: string;
  senderName: string;
  content: string;
  createdAt: string;
  isPinned?: boolean;
}

export function AnnouncementsWidget() {
  const router = useRouter();
  const [announcements, setAnnouncements] = React.useState<AnnouncementItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;

    const fetchAnnouncements = async () => {
      try {
        setIsLoading(true);

        // 1. Fetch student's enrolled courses
        const courseRes = await apiClient.get("/api/v1/courses", { params: { page: 1, page_size: 50 } });
        const raw = courseRes.data;
        let coursesList: any[] = [];
        if (Array.isArray(raw?.data)) coursesList = raw.data;
        else if (Array.isArray(raw?.data?.items)) coursesList = raw.data.items;
        else if (Array.isArray(raw?.items)) coursesList = raw.items;
        else if (Array.isArray(raw)) coursesList = raw;

        const validCourses = coursesList.filter((c) => Boolean(c?.id || c?.course_id));

        if (validCourses.length === 0) {
          if (isMounted) {
            setAnnouncements([]);
            setIsLoading(false);
          }
          return;
        }

        // 2. Fetch announcements from global and course-specific announcement chat rooms
        const results = await Promise.all(
          validCourses.map(async (c) => {
            const courseId = c.id || c.course_id;
            const courseTitle = c.title || c.course_title || "Course";
            try {
              const res = await apiClient.get(
                `/api/v1/chat/${courseId}/messages?limit=10&room_type=global_announcement&announcements_only=true`
              );
              const msgs: any[] = res.data?.data?.messages ?? [];
              return msgs
                .filter((m) => m.is_announcement)
                .map((m) => ({
                  id: m.id,
                  courseId,
                  courseTitle,
                  senderName: m.sender?.full_name || (m.sender as any)?.name || "Instructor",
                  content: m.content,
                  createdAt: m.created_at,
                  isPinned: Boolean(m.is_pinned),
                }));
            } catch {
              return [];
            }
          })
        );

        // 3. Fallback to /api/v1/notifications for announcements if chat returned empty
        let fallbackNotifs: AnnouncementItem[] = [];
        if (results.flat().length === 0) {
          try {
            const notifRes = await apiClient.get("/api/v1/notifications?page=1&page_size=10");
            const notifData = notifRes.data?.data || notifRes.data?.items || notifRes.data || [];
            const notifItems = Array.isArray(notifData) ? notifData : [];
            fallbackNotifs = notifItems
              .filter(
                (n: any) =>
                  String(n.type || "").toLowerCase().includes("announcement") ||
                  String(n.title || "").toLowerCase().includes("announcement")
              )
              .map((n: any) => ({
                id: n.id,
                courseId: n.entity_id || "",
                courseTitle: n.metadata?.course_title || "General Announcement",
                senderName: n.metadata?.teacher_name || "Instructor",
                content: n.body || n.title || "",
                createdAt: n.created_at || new Date().toISOString(),
                isPinned: false,
              }));
          } catch {
            // ignore
          }
        }

        // Merge, deduplicate by content & sender, sort newest first
        const all = [...results.flat(), ...fallbackNotifs];
        const seen = new Set<string>();
        const unique: AnnouncementItem[] = [];

        for (const item of all) {
          if (!item.content?.trim()) continue;
          const cleanKey = `${item.content.trim()}__${item.senderName}`;
          if (!seen.has(item.id) && !seen.has(cleanKey)) {
            seen.add(item.id);
            seen.add(cleanKey);
            unique.push(item);
          }
        }

        unique.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (isMounted) {
          // Exactly the last 3 announcements as requested
          setAnnouncements(unique.slice(0, 3));
        }
      } catch (error) {
        console.error("Failed to load announcements:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchAnnouncements();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAnnouncementClick = (announcement: AnnouncementItem) => {
    if (announcement.courseId) {
      router.push(`/student/messages?courseId=${announcement.courseId}`);
    } else {
      router.push("/student/messages");
    }
  };

  return (
    <Card className="h-full flex flex-col card-glass hover-lift" style={{ borderRadius: 16 }}>
      <CardHeader className="p-4 sm:p-6 pb-0 flex flex-row items-center justify-between">
        <CardTitle className="text-responsive-lg flex items-center gap-2 text-foreground font-extrabold">
          <Megaphone className="h-4 w-4 text-amber-500" />
          Announcements
          {announcements.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
              Latest {announcements.length}
            </span>
          )}
        </CardTitle>
        <Link href="/student/messages">
          <Button variant="ghost" size="sm" className="text-xs hover:text-primary/80 -mr-2 text-primary btn-ghost press-scale">
            View All <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-4 flex-1 flex flex-col justify-between">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-16 rounded-xl bg-border/40 animate-pulse" />
            <div className="h-16 rounded-xl bg-border/40 animate-pulse" />
            <div className="h-16 rounded-xl bg-border/40 animate-pulse" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-2 flex-1">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-muted-foreground">No new announcements</p>
            <p className="text-xs text-muted-foreground/80 max-w-xs">
              When your instructors post notices in the announcement channel, the last 3 will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement, idx) => {
              let relativeTime = "Recently";
              try {
                if (announcement.createdAt) {
                  relativeTime = formatDistanceToNow(parseISO(announcement.createdAt), { addSuffix: true });
                }
              } catch {
                relativeTime = "Recently";
              }

              return (
                <div
                  key={announcement.id || `ann-${idx}`}
                  onClick={() => handleAnnouncementClick(announcement)}
                  className="group flex flex-col gap-1.5 p-3 rounded-xl transition-all cursor-pointer bg-card/60 hover:bg-card border border-border/80 hover:border-amber-500/40 hover-lift"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {announcement.isPinned && <Pin className="h-3 w-3 fill-current text-amber-400 flex-shrink-0" />}
                      <span className="text-xs font-bold text-foreground truncate flex items-center gap-1">
                        <span className="text-amber-400">{announcement.senderName}</span>
                        {announcement.courseTitle && (
                          <span className="text-slate-400 font-normal truncate max-w-[140px]">
                            • {announcement.courseTitle}
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="text-[10px] shrink-0 text-muted-foreground font-medium flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {relativeTime}
                    </span>
                  </div>
                  <p className="text-xs line-clamp-2 text-slate-300 leading-relaxed group-hover:text-white transition-colors">
                    {announcement.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

