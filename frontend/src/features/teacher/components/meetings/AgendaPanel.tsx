"use client";

import * as React from "react";
import { parseISO, addMinutes } from "date-fns";
import { MeetingCard } from "./MeetingCard";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { useTeacherMeetings } from "@/hooks/queries/useTeacherQueries";

export function AgendaPanel() {
  const { data, isLoading } = useTeacherMeetings({ page: 1, pageSize: 100 });
  const meetings = data?.items ?? [];

  const [statusFilter, setStatusFilter] = React.useState<"ALL" | "LIVE" | "SCHEDULED" | "ENDED">("ALL");

  const now = Date.now();

  const formattedMeetings = meetings
    .map((m) => {
      const dateStr = m.scheduledAt || (m as any).scheduled_at;
      let start: Date;
      try {
        start = dateStr ? parseISO(dateStr) : new Date();
        if (isNaN(start.getTime())) start = new Date();
      } catch {
        start = new Date();
      }
      const duration = Number(m.durationMinutes || (m as any).duration_minutes || 60);
      const end = addMinutes(start, duration);
      const startMs = start.getTime();
      const endMs = end.getTime();

      const isCancelled = m.status === "CANCELLED";
      const isLive = !isCancelled && now >= startMs && now <= endMs;
      const isPast = !isCancelled && now > endMs;
      const isUpcoming = !isCancelled && now < startMs;

      return {
        ...m,
        start,
        end,
        isLive,
        isPast,
        isUpcoming,
        courseName: (m as any).courseTitle || m.courseName || (m as any).course_title || m.courseId || "Course",
      };
    })
    .filter((m) => {
      if (statusFilter === "ALL") return true;
      if (statusFilter === "LIVE") return m.isLive;
      if (statusFilter === "SCHEDULED") return m.isUpcoming;
      if (statusFilter === "ENDED") return m.isPast;
      return true;
    })
    .sort((a, b) => b.start.getTime() - a.start.getTime());

  return (
    <div className="card-glass w-full flex flex-col overflow-hidden animate-fade-up p-6 rounded-2xl border border-border/50">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-border/50 gap-4">
        <div>
          <h3 className="font-extrabold text-foreground text-xl tracking-tight">Scheduled Live Sessions</h3>
          <p className="text-xs text-muted-foreground mt-1">Manage and launch your upcoming and past course meetings.</p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-secondary/40 rounded-xl border border-border/60">
          {(["ALL", "LIVE", "SCHEDULED", "ENDED"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
                statusFilter === filter
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Meeting Grid */}
      <div className="pt-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 text-violet-400/50 animate-spin" />
          </div>
        ) : formattedMeetings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {formattedMeetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting as any} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-4 opacity-80 border border-dashed border-border/60 rounded-xl bg-card/40">
            <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center">
              <CalendarIcon className="h-8 w-8 opacity-50 text-violet-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-foreground">No meetings found.</p>
              <p className="text-xs text-muted-foreground">Click &quot;Schedule Live Class&quot; to set up your next session.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
