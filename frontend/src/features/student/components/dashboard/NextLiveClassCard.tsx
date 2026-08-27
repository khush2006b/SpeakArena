"use client";

import * as React from "react";
import { Video, Calendar, User, Loader2, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api/client";

import { getMeetingStatus } from "@/lib/meeting-status";

export function NextLiveClassCard() {
  const [allMeetings, setAllMeetings] = React.useState<any[]>([]);
  const [nowMs, setNowMs] = React.useState<number>(Date.now());
  const [isLoading, setIsLoading] = React.useState(true);

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
                className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold border ${
                  currentStatus === "LIVE"
                    ? "bg-red-500/20 text-red-400 border-red-500/30"
                    : "text-primary badge-primary bg-primary/10 border-primary/25"
                }`}
                style={{ borderRadius: 100 }}
              >
                <span className="relative flex h-2 w-2 mr-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${currentStatus === "LIVE" ? "bg-red-500" : "bg-primary"}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${currentStatus === "LIVE" ? "bg-red-500" : "bg-primary"}`}></span>
                </span>
                {currentStatus === "LIVE" ? "LIVE NOW" : "Next Live Class"}
              </div>
              <span className="text-sm font-bold text-foreground">
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
                onClick={() => {
                  const link = activeMeeting.meet_link || activeMeeting.meetLink;
                  if (link) window.open(link, '_blank');
                  else window.location.href = '/student/live';
                }}
                className={`flex-1 shadow-md transition-all font-bold press-scale ${
                  currentStatus === "LIVE" ? "bg-red-500 hover:bg-red-600 text-white" : "btn-primary"
                }`}
                style={{ borderRadius: 10 }}>
                <Video className="mr-2 h-4 w-4" />
                {currentStatus === "LIVE" ? "Join Class Now" : "Join Class"}
              </Button>
              <Button variant="outline" size="icon" className="shrink-0 text-muted-foreground btn-outline press-scale" title="Add to Calendar"
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

