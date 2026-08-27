"use client";

import * as React from "react";
import Link from "next/link";
import { Video, CalendarDays, Loader2, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeacherMeetings, useJoinMeeting } from "@/hooks/queries/useTeacherQueries";
import { useMeetingStore } from "@/stores/meeting.store";
import { format, isToday, parseISO } from "date-fns";
import type { Meeting } from "@/types";

function getMeetingStatus(meeting: Meeting) {
  const now = new Date();
  const start = parseISO(meeting.scheduledAt);
  if (meeting.status === "LIVE") return "live";
  if (meeting.status === "SCHEDULED" && start > now) return "upcoming";
  return "past";
}

export function TodaysSchedule() {
  const { data, isLoading } = useTeacherMeetings(
    { page: 1, pageSize: 20 },
    { status: "LIVE,SCHEDULED" }
  );
  const joinMutation = useJoinMeeting();
  const setCreateModalOpen = useMeetingStore((s) => s.setCreateModalOpen);

  const allMeetings = React.useMemo(() => {
    const raw = data?.items ?? [];
    return raw
      .map((m) => ({
        ...m,
        scheduledAt: m.scheduledAt || (m as any).scheduled_at || new Date().toISOString(),
      }))
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [data]);

  const todaysMeetings = React.useMemo(() => {
    return allMeetings.filter((m) => {
      try {
        return isToday(parseISO(m.scheduledAt));
      } catch {
        return false;
      }
    });
  }, [allMeetings]);

  const displayMeetings = todaysMeetings.length > 0 ? todaysMeetings : allMeetings.slice(0, 5);
  const isShowingUpcomingFallback = todaysMeetings.length === 0 && displayMeetings.length > 0;

  return (
    <div className="card-glass hover-lift rounded-2xl bg-card border border-border overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-border bg-muted/30 flex items-center justify-between">
        <div>
          <h3 className="m-0 text-base font-extrabold text-foreground tracking-tight">
            {isShowingUpcomingFallback ? "Upcoming Schedule" : "Today's Schedule"}
          </h3>
          <p className="m-0 text-xs text-muted-foreground mt-0.5">{format(new Date(), "EEEE, MMM d, yyyy")}</p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-600/20 text-violet-400 hover:bg-violet-600/30 border border-violet-500/30 text-xs font-bold transition-all press-scale cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Schedule
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[380px]">
        {isLoading ? (
          <div className="p-4 flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl bg-border" />
            ))}
          </div>
        ) : displayMeetings.length === 0 ? (
          <div className="py-10 px-5 flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="m-0 text-sm font-semibold text-foreground">No sessions scheduled</p>
            <p className="m-0 text-xs text-muted-foreground mt-1">Schedule your next live class session for your students.</p>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-500 transition-all press-scale cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Schedule a Session
            </button>
          </div>
        ) : (
          <div className="p-3 flex flex-col gap-2">
            {displayMeetings.map((session) => {
              const status = getMeetingStatus(session);
              const start = parseISO(session.scheduledAt);
              const isJoining = joinMutation.isPending && joinMutation.variables === session.id;
              const rawMeetLink = session.meetLink || session.meet_link || (session as any).meeting_url;
              const meetUrl = rawMeetLink ? (rawMeetLink.startsWith("http") ? rawMeetLink : `https://${rawMeetLink}`) : null;

              return (
                <div
                  key={session.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    status === "live"
                      ? "bg-red-500/5 border-red-500/20"
                      : "bg-muted/30 border-border hover:border-violet-500/30 hover:bg-muted/50"
                  }`}
                >
                  {/* Left accent line */}
                  <div className={`w-1 self-stretch rounded-full shrink-0 ${
                    status === "live" ? "bg-red-500" : "bg-violet-500"
                  }`} />

                  {/* Date/Time */}
                  <div className="flex flex-col items-center min-w-[50px]">
                    <span className="text-[10px] font-semibold text-muted-foreground">{format(start, "MMM d")}</span>
                    <span className="text-xs font-bold text-foreground">{format(start, "h:mm")}</span>
                    <span className="text-[9px] font-semibold text-muted-foreground">{format(start, "a")}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="m-0 text-xs font-bold text-foreground truncate">{session.title}</p>
                    <p className="m-0 text-[10px] text-muted-foreground truncate mt-0.5">
                      {session.courseTitle || (session as any).course_title || "Course Session"}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {status === "live" ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                          Live
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-violet-500/15 text-violet-400 border border-violet-500/30 px-1.5 py-0.5 rounded">
                          {session.durationMinutes}m
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  {status === "live" || meetUrl ? (
                    <a
                      href={meetUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-1 h-7 px-2.5 text-[10px] font-bold bg-violet-600 text-white border-none rounded-lg cursor-pointer hover:bg-violet-500 transition-all press-scale no-underline"
                    >
                      <Video className="w-3 h-3" />
                      Join
                    </a>
                  ) : (
                    <Link
                      href="/teacher/meetings"
                      className="shrink-0 h-7 px-2.5 inline-flex items-center text-[10px] font-bold text-muted-foreground bg-muted hover:bg-muted/80 rounded-lg no-underline transition-colors"
                    >
                      View
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border flex items-center justify-between gap-2">
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex-1 py-2 rounded-xl text-xs font-bold text-violet-400 hover:bg-violet-500/10 border border-violet-500/20 transition-all cursor-pointer"
        >
          + Schedule New Session
        </button>
        <Link
          href="/teacher/meetings"
          className="py-2 px-3 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all no-underline shrink-0"
        >
          All Meetings →
        </Link>
      </div>
    </div>
  );
}
