"use client";

import * as React from "react";
import { Video, Calendar, User, Loader2, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api/client";

import { useJoinMeeting } from "@/hooks/queries/useMeetingQueries";
import { toast } from "sonner";
import { useChatStore } from "@/stores/chat.store";
import Link from "next/link";
import { MessageSquare } from "lucide-react";

import { getMeetingStatus } from "@/lib/utils";

export function NextLiveClassCard() {
  const { hasUnread } = useChatStore();
  const [allMeetings, setAllMeetings] = React.useState<any[]>([]);
  const [nowMs, setNowMs] = React.useState<number>(Date.now());
  const [isLoading, setIsLoading] = React.useState(true);
  const joinMutation = useJoinMeeting();

  const handleJoin = (meeting: any) => {
    if (!meeting?.id) {
      window.location.href = '/student/live';
      return;
    }
    toast.info("Connecting to live class...");
    joinMutation.mutate(meeting.id, {
      onSuccess: () => {
        toast.success("Joining Google Meet...");
      },
      onError: (err: any) => {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Could not join meeting.";
        toast.error(msg);
      },
    });
  };

  // 1. Fetch meeting list
  React.useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const res = await apiClient.get("/api/v1/meetings?page=1&page_size=20");
        const data = res.data?.data || res.data || [];
        const items: any[] = Array.isArray(data) ? data : (data.items || []);
        setAllMeetings(items);
      } catch (error) {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    fetchMeetings();
  }, []);

  // 2. Real-time timer ticker (updates every 5s so status transitions LIVE -> ENDED automatically)
  React.useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // 3. Filter out ENDED / CANCELLED meetings from Dashboard (Dashboard removes ended meetings)
  const activeMeetings = allMeetings.filter((m) => {
    const st = getMeetingStatus(m, nowMs);
    return st === "LIVE" || st === "UPCOMING";
  });

  // Pick LIVE meeting first, else earliest UPCOMING
  const activeMeeting = activeMeetings.find((m) => getMeetingStatus(m, nowMs) === "LIVE") || activeMeetings[0] || null;
  const currentStatus = activeMeeting ? getMeetingStatus(activeMeeting, nowMs) : "ENDED";


  return (
    <Card className="h-full overflow-hidden group card-glass hover-lift" style={{ borderRadius: 16 }}>
      <CardContent className="p-4 sm:p-6 lg:p-8 flex flex-col h-full">
        {isLoading ? (
          <div className="flex-1 flex justify-center items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !activeMeeting ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 py-6">
            <Calendar className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No upcoming live classes</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div
                className="inline-flex items-center px-3 py-1 text-xs font-extrabold border"
                style={{
                  borderRadius: 100,
                  background: "rgba(37, 99, 235, 0.25)",
                  color: "#60a5fa",
                  borderColor: "rgba(59, 130, 246, 0.5)",
                }}
              >
                <span className="relative flex h-2 w-2 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-blue-500"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                {currentStatus === "LIVE" ? "LIVE NOW" : "NEXT LIVE CLASS"}
              </div>
              <span className="text-sm font-bold" style={{ color: "#60a5fa" }}>
                {currentStatus === "LIVE" ? "Live Now" : "Upcoming"}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 space-y-3">
              <h3 className="font-semibold text-responsive-lg leading-tight line-clamp-2 text-foreground">
                {activeMeeting.title || "Live Session"}
              </h3>
              <div className="space-y-1.5">
                <p className="text-sm flex items-center gap-2 text-muted-foreground">
                  <BookOpen className="h-4 w-4" />
                  <span className="truncate">
                    {activeMeeting.courseTitle || (activeMeeting.scheduled_at ? new Date(activeMeeting.scheduled_at).toLocaleString() : "TBA")}
                  </span>
                </p>
                <p className="text-sm flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{activeMeeting.teacherName || activeMeeting.instructor || "Instructor"}</span>
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-6 mt-auto flex items-center gap-3">
              <Button 
                onClick={() => handleJoin(activeMeeting)}
                disabled={joinMutation.isPending}
                className="flex-1 shadow-lg transition-all font-extrabold press-scale text-white border-none"
                style={{ 
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
                  color: "#ffffff",
                  boxShadow: "0 4px 16px rgba(37, 99, 235, 0.4)",
                }}>
                <Video className="mr-2 h-4 w-4 fill-current text-white" />
                {currentStatus === "LIVE" ? "Join Class Now" : "Join Class"}
              </Button>
              <Link href={`/student/messages?courseId=${activeMeeting.course_id || activeMeeting.courseId || ""}`}>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="shrink-0 text-muted-foreground btn-outline press-scale relative" 
                  title="Class Chat"
                  style={{ borderRadius: 10 }}
                >
                  <MessageSquare className="h-4 w-4" />
                  {hasUnread && (
                    <span style={{ position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: "50%", background: "#ef4444" }} className="animate-pulse" />
                  )}
                </Button>
              </Link>
              <Button variant="outline" size="icon" className="shrink-0 text-muted-foreground btn-outline press-scale" title="Schedule"
                      style={{ borderRadius: 10 }}>
                <Calendar className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

