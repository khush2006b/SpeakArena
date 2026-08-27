"use client";

import * as React from "react";
import { Calendar as CalendarIcon, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { apiClient } from "@/services/api/client";

import { getMeetingStatus } from "@/lib/utils";

export function DashboardCalendar() {
  const [allMeetings, setAllMeetings] = React.useState<any[]>([]);
  const [nowMs, setNowMs] = React.useState<number>(Date.now());
  const [isLoading, setIsLoading] = React.useState(true);

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

  // 5s real-time timer ticker
  React.useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Filter out ENDED / CANCELLED meetings for Dashboard Calendar
  const activeMeetings = allMeetings.filter((m) => {
    const st = getMeetingStatus(m, nowMs);
    return st === "LIVE" || st === "UPCOMING";
  });

  const meetings = activeMeetings.slice(0, 5);


  return (
    <Card className="h-full flex flex-col card-glass hover-lift" style={{ borderRadius: 16 }}>
      <CardHeader className="p-4 sm:p-6 pb-0 flex flex-row items-center justify-between">
        <CardTitle className="text-responsive-lg flex items-center gap-2 text-foreground font-extrabold">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          Study Calendar
        </CardTitle>
        <Link href="/student/live">
          <Button variant="ghost" size="sm" className="text-xs hover:text-primary/80 -mr-2 text-primary btn-ghost press-scale">
            View All <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-4 flex-1 flex flex-col gap-4">
        
        {isLoading ? (
          <div className="space-y-4 py-4">
             <div className="h-12 rounded-lg bg-border/40 animate-pulse" />
             <div className="h-12 rounded-lg bg-border/40 animate-pulse" />
          </div>
        ) : meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center h-full">
            <CalendarIcon className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No upcoming meetings</p>
          </div>
        ) : (
          meetings.map((meeting: any, idx: number) => {
            const date = meeting.scheduled_at ? new Date(meeting.scheduled_at) : new Date();
            const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
            const day = date.getDate();
            const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div key={meeting.id || idx} className="flex gap-4 group cursor-pointer p-2 rounded-xl transition-colors hover:bg-accent/50" style={{ borderRadius: 10 }}>
                <div className="flex flex-col items-center justify-center w-12 shrink-0 rounded-lg p-1.5 transition-colors bg-primary/10 border border-primary/30">
                  <span className="text-xs font-bold text-primary">{month}</span>
                  <span className="text-lg font-black text-foreground">{day}</span>
                </div>
                <div className="flex flex-col justify-center">
                  <span className="text-xs font-semibold mb-0.5 text-primary">{time}</span>
                  <span className="text-sm font-semibold line-clamp-1 text-foreground">{meeting.title || "Live Meeting"}</span>
                  <span className="text-xs line-clamp-1 text-muted-foreground">{meeting.courseTitle || "Scheduled Session"}</span>
                </div>
              </div>
            );
          })
        )}
        
        <div className="mt-auto" />
      </CardContent>
    </Card>
  );
}
