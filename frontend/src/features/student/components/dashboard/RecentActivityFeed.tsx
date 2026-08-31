"use client";

import * as React from "react";
import { PlayCircle, Video, FileText, ChevronRight, Activity, BookOpen, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { apiClient } from "@/services/api/client";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, parseISO } from "date-fns";

export interface ActivityFeedItem {
  id: string;
  category: "meeting" | "resource";
  type: string;
  title: string;
  subtitle: string;
  actionUrl: string;
  createdAt: string;
  isLive?: boolean;
}

export function RecentActivityFeed() {
  const router = useRouter();
  const [activities, setActivities] = React.useState<ActivityFeedItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;

    const fetchActivity = async () => {
      try {
        setIsLoading(true);

        // 1. Fetch scheduled meetings / live sessions
        let meetings: any[] = [];
        try {
          const mRes = await apiClient.get("/api/v1/meetings", { params: { page: 1, page_size: 10 } });
          const mRaw = mRes.data;
          if (Array.isArray(mRaw?.data)) meetings = mRaw.data;
          else if (Array.isArray(mRaw?.items)) meetings = mRaw.items;
          else if (Array.isArray(mRaw)) meetings = mRaw;
        } catch {
          // ignore
        }

        // 2. Fetch in-app notifications (focus on resources & meetings)
        let notifs: any[] = [];
        try {
          const nRes = await apiClient.get("/api/v1/notifications", { params: { page: 1, page_size: 20 } });
          const nRaw = nRes.data;
          if (Array.isArray(nRaw?.data)) notifs = nRaw.data;
          else if (Array.isArray(nRaw?.items)) notifs = nRaw.items;
          else if (Array.isArray(nRaw)) notifs = nRaw;
        } catch {
          // ignore
        }

        const items: ActivityFeedItem[] = [];
        const seen = new Set<string>();

        // Process meetings
        const now = new Date();
        meetings.forEach((m: any) => {
          const mId = `meet-${m.id || m.meeting_id}`;
          if (!seen.has(mId)) {
            seen.add(mId);
            const startIso = m.start_time || m.scheduled_at || m.start_at || m.created_at;
            const endIso = m.end_time || m.end_at;
            const startTime = startIso ? new Date(startIso) : new Date();
            const endTime = endIso ? new Date(endIso) : new Date(startTime.getTime() + 60 * 60 * 1000);
            const isLive = m.status === "in_progress" || m.status === "live" || (now >= startTime && now <= endTime);

            items.push({
              id: mId,
              category: "meeting",
              type: "meeting",
              title: m.title || m.topic || "Scheduled Live Class",
              subtitle: isLive ? "● Live Now — Join Session" : m.course_title || m.course?.title || "Upcoming Class Session",
              actionUrl: "/student/live",
              createdAt: startIso || new Date().toISOString(),
              isLive,
            });
          }
        });

        // Process resource / meeting notifications
        notifs.forEach((n: any) => {
          const nType = String(n.type || n.notification_type || "").toLowerCase();
          const eType = String(n.entity_type || "").toLowerCase();
          const title = n.title || "";
          const isResource =
            nType.includes("resource") ||
            eType === "video" ||
            eType === "pdf" ||
            eType === "resource" ||
            title.toLowerCase().includes("resource") ||
            title.toLowerCase().includes("pdf") ||
            title.toLowerCase().includes("video");

          const isMeeting =
            nType.includes("meeting") ||
            nType.includes("live") ||
            eType === "meeting" ||
            title.toLowerCase().includes("meeting") ||
            title.toLowerCase().includes("class");

          if (isResource) {
            const id = `notif-${n.id}`;
            if (!seen.has(id)) {
              seen.add(id);
              items.push({
                id,
                category: "resource",
                type: eType === "video" || title.toLowerCase().includes("video") ? "video" : "pdf",
                title: n.title || "New Learning Material",
                subtitle: n.body || n.message || "A new resource has been uploaded for your course.",
                actionUrl: n.action_url || "/student/resources",
                createdAt: n.created_at || new Date().toISOString(),
              });
            }
          } else if (isMeeting) {
            const id = `notif-${n.id}`;
            if (!seen.has(id)) {
              seen.add(id);
              items.push({
                id,
                category: "meeting",
                type: "meeting",
                title: n.title || "Live Class Scheduled",
                subtitle: n.body || n.message || "A new live class session has been scheduled.",
                actionUrl: n.action_url || "/student/live",
                createdAt: n.created_at || new Date().toISOString(),
              });
            }
          }
        });

        // Sort newest first and pick top 4
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (isMounted) {
          setActivities(items.slice(0, 4));
        }
      } catch (error) {
        console.error("Failed to load activity:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchActivity();

    return () => {
      isMounted = false;
    };
  }, []);

  const getIcon = (item: ActivityFeedItem) => {
    if (item.category === "meeting") {
      return (
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
          item.isLive ? "bg-blue-500 text-white animate-pulse" : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
        }`}>
          <Video className="h-4 w-4" />
        </div>
      );
    }
    if (item.type === "video") {
      return (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400 border border-violet-500/30">
          <PlayCircle className="h-4 w-4" />
        </div>
      );
    }
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        <FileText className="h-4 w-4" />
      </div>
    );
  };

  const handleActivityClick = (item: ActivityFeedItem) => {
    router.push(item.actionUrl);
  };

  return (
    <Card className="h-full flex flex-col card-glass hover-lift" style={{ borderRadius: 16 }}>
      <CardHeader className="p-4 sm:p-6 pb-0 flex flex-row items-center justify-between">
        <CardTitle className="text-responsive-lg flex items-center gap-2 text-foreground font-extrabold">
          <Activity className="h-4 w-4 text-primary" />
          Recent Activity
          {activities.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
              Live & Resources
            </span>
          )}
        </CardTitle>
        <Link href="/student/notifications">
          <Button variant="ghost" size="sm" className="text-xs hover:text-primary/80 -mr-2 text-primary btn-ghost press-scale">
            View All <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-4 flex-1 flex flex-col justify-between">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-14 rounded-xl bg-border/40 animate-pulse" />
            <div className="h-14 rounded-xl bg-border/40 animate-pulse" />
            <div className="h-14 rounded-xl bg-border/40 animate-pulse" />
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-2 flex-1">
            <Activity className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-muted-foreground">No recent activity</p>
            <p className="text-xs text-muted-foreground/80 max-w-xs">
              Upcoming scheduled classes and new course resources will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activities.map((activity) => {
              let relativeTime = "Recently";
              try {
                if (activity.createdAt) {
                  relativeTime = formatDistanceToNow(parseISO(activity.createdAt), { addSuffix: true });
                }
              } catch {
                relativeTime = "Recently";
              }

              return (
                <div
                  key={activity.id}
                  onClick={() => handleActivityClick(activity)}
                  className="group relative flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all bg-card/60 hover:bg-card border border-border/80 hover:border-primary/40 hover-lift"
                >
                  {getIcon(activity)}

                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold line-clamp-1 text-foreground group-hover:text-primary transition-colors">
                        {activity.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-medium flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {relativeTime}
                      </span>
                    </div>
                    <span className={`text-[11px] line-clamp-1 ${activity.isLive ? "text-blue-400 font-bold" : "text-muted-foreground"}`}>
                      {activity.subtitle}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

