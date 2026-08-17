"use client";

import * as React from "react";
import { format, isSameDay, parseISO, addMinutes } from "date-fns";
import { useMeetingStore } from "@/stores/meeting.store";
import { MeetingCard } from "./MeetingCard";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { useTeacherMeetings } from "@/hooks/queries/useTeacherQueries";

export function AgendaPanel() {
  const { currentDate } = useMeetingStore();
  const { data, isLoading } = useTeacherMeetings({ page: 1, pageSize: 100 });
  const meetings = data?.items ?? [];

  const todaysMeetings = meetings
    .map((m) => {
      const start = parseISO(m.scheduledAt);
      return {
        ...m,
        start,
        end: addMinutes(start, m.durationMinutes),
        courseName: m.courseId,
      };
    })
    .filter((m) => isSameDay(m.start, currentDate))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  return (
    <div className="card-glass h-full w-full flex flex-col overflow-hidden animate-fade-up">
      {/* Sticky Header */}
      <div className="px-5 py-4 border-b border-border/50 sticky top-0 bg-card/90 backdrop-blur-xl z-10 flex items-center justify-between">
        <h3 className="font-extrabold text-foreground text-lg">Agenda</h3>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-secondary/50 border border-border/60 px-3 py-1 rounded-full">
          {format(currentDate, "MMM d")}
        </span>
      </div>

      {/* Meeting List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 text-violet-400/40 animate-spin" />
          </div>
        ) : todaysMeetings.length > 0 ? (
          todaysMeetings.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting as any} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-4 opacity-80">
            <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center">
              <CalendarIcon className="h-8 w-8 opacity-50" />
            </div>
            <p className="text-sm font-semibold">No classes scheduled for today.</p>
          </div>
        )}
      </div>
    </div>
  );
}
