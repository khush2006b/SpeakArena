"use client";

import * as React from "react";
import { Calendar, dateFnsLocalizer, EventProps } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, parseISO, addMinutes } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { Video, Loader2 } from "lucide-react";
import { useMeetingStore } from "@/stores/meeting.store";
import { useTeacherMeetings } from "@/hooks/queries/useTeacherQueries";
import { cn } from "@/lib/utils";

import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

function CustomEvent({ event }: EventProps<any>) {
  const { setActiveMeeting } = useMeetingStore();
  const isCancelled = event.status === "CANCELLED";
  const isLive = event.status === "LIVE";
  const isCompleted = event.status === "ENDED";

  return (
    <div
      className={cn(
        "flex flex-col h-full w-full p-2 overflow-hidden rounded-lg text-xs transition-all border-l-2 shadow-sm",
        isCancelled
          ? "bg-secondary/30 text-muted-foreground border-muted-foreground/30 line-through opacity-70 grayscale-[0.5]"
          : isLive
          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.2)] animate-pulse"
          : isCompleted
          ? "bg-secondary/30 text-foreground border-border"
          : "bg-violet-500/15 text-violet-300 border-violet-500 hover:bg-violet-500/25 shadow-[0_0_8px_hsl(var(--primary)/0.1)]"
      )}
      onClick={() => setActiveMeeting(event)}
    >
      <div className="font-bold tracking-tight truncate">{event.title}</div>
      <div className="flex items-center gap-1.5 mt-1 opacity-90 font-medium">
        <span className="truncate text-[10px] uppercase tracking-wider">{format(event.start, "h:mm a")}</span>
        {event.meetLink && <Video className="h-3 w-3 shrink-0" />}
      </div>
    </div>
  );
}

export function CalendarWidget() {
  const { calendarView, currentDate, setCalendarView, setCurrentDate } = useMeetingStore();
  const { data, isLoading } = useTeacherMeetings({ page: 1, pageSize: 100 });

  const meetings = data?.items ?? [];
  const events = meetings.map((m) => {
    const start = parseISO(m.scheduledAt);
    return {
      ...m,
      start,
      end: addMinutes(start, m.durationMinutes),
    };
  });

  const handleNavigate = (newDate: Date) => {
    setCurrentDate(newDate);
  };

  const handleView = (newView: "month" | "week" | "day" | "agenda") => {
    setCalendarView(newView);
  };

  return (
    <div className="card-glass h-full w-full flex flex-col relative">
      <style dangerouslySetInnerHTML={{ __html: `
        /* Premium Tailwind Overrides for React Big Calendar */
        .rbc-calendar { font-family: inherit; border: none; background: transparent; }
        .rbc-header { padding: 12px 8px; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid hsl(var(--border) / 0.5) !important; border-left: none !important; color: "hsl(var(--muted-foreground))"; background: transparent; }
        .rbc-month-view { border: none !important; background: transparent; }
        .rbc-month-row { border-bottom: 1px solid hsl(var(--border) / 0.3) !important; }
        .rbc-day-bg { border-left: 1px solid hsl(var(--border) / 0.3) !important; transition: background-color 0.3s; }
        .rbc-day-bg:hover { background-color: "hsl(var(--accent) / 0.5)"; }
        .rbc-day-bg.rbc-today { background-color: "hsl(var(--primary) / 0.05)" !important; }
        .rbc-date-cell { padding: 8px; font-size: 14px; font-weight: 700; color: "hsl(var(--foreground))"; }
        .rbc-date-cell.rbc-now { font-weight: 900; color: "hsl(var(--primary))"; }
        .rbc-event { background: transparent !important; padding: 2px !important; border: none !important; }
        .rbc-event:focus { outline: none !important; }
        .rbc-row-segment { padding: 0 4px; }
        .rbc-time-view { border: none !important; background: transparent; }
        .rbc-time-header { border-bottom: 1px solid hsl(var(--border) / 0.5) !important; }
        .rbc-time-content { border-top: none !important; }
        .rbc-time-gutter { border-right: 1px solid hsl(var(--border) / 0.3) !important; }
        .rbc-timeslot-group { border-bottom: 1px solid hsl(var(--border) / 0.3) !important; }
        .rbc-time-slot { font-size: 11px; font-weight: 600; color: "hsl(var(--muted-foreground))"; text-transform: uppercase; letter-spacing: 0.05em; }
        .rbc-current-time-indicator { background-color: "hsl(var(--primary))" !important; height: 2px !important; }
        .rbc-toolbar { display: none !important; }
        .rbc-agenda-view { border: none !important; background: transparent; }
        .rbc-agenda-view table.rbc-agenda-table { border: none !important; }
        .rbc-agenda-view table.rbc-agenda-table thead > tr > th { border-bottom: 1px solid hsl(var(--border) / 0.5) !important; padding: 12px 8px; text-align: left; color: "hsl(var(--muted-foreground))"; background: transparent; }
        .rbc-agenda-view table.rbc-agenda-table tbody > tr > td { border-top: 1px solid hsl(var(--border) / 0.3) !important; padding: 12px 8px; color: "hsl(var(--foreground))"; background: transparent; }
        .rbc-off-range-bg { background: "hsl(var(--card) / 0.3)"; }
      `}} />

      <div className="flex-1 min-h-[600px] p-4 relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-2xl">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          </div>
        )}
        <Calendar
          localizer={localizer}
          events={events}
          view={calendarView}
          date={currentDate}
          onNavigate={handleNavigate}
          onView={(v) => handleView(v as any)}
          startAccessor="start"
          endAccessor="end"
          components={{
            event: CustomEvent,
          }}
          formats={{
            timeGutterFormat: (date, culture, localizer) => localizer!.format(date, "h a", culture),
            eventTimeRangeFormat: () => "",
            agendaTimeRangeFormat: (range, culture, localizer) =>
              `${localizer!.format(range.start, "h:mm a", culture)} - ${localizer!.format(range.end, "h:mm a", culture)}`,
          }}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
