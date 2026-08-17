"use client";

import * as React from "react";
import Link from "next/link";
import { Video, Users, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeacherMeetings, useJoinMeeting } from "@/hooks/queries/useTeacherQueries";
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
    { page: 1, pageSize: 10 },
    { status: "LIVE,SCHEDULED" },
  );
  const joinMutation = useJoinMeeting();

  const todaysMeetings = (data?.items ?? []).filter((m) => {
    try {
      return isToday(parseISO(m.scheduledAt));
    } catch {
      return false;
    }
  });

  return (
    <div className="card-glass hover-lift rounded-2xl bg-card border border-border overflow-hidden h-full flex flex-col">
      <div className="p-4 sm:p-6 border-b border-border bg-muted/30">
        <h3 className="m-0 text-lg font-extrabold text-foreground tracking-tight">Today's Schedule</h3>
      </div>
      <div className="p-4 sm:p-6 flex-1 custom-scrollbar overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl bg-border" />
            ))}
          </div>
        ) : todaysMeetings.length === 0 ? (
          <div className="py-8 flex flex-col items-center text-center">
            <p className="m-0 text-sm text-muted-foreground font-medium">No sessions scheduled for today.</p>
            <Link href="/teacher/meetings" className="mt-4 inline-block bg-transparent border border-border rounded-lg px-4 py-2 text-foreground text-sm font-semibold no-underline hover:bg-muted transition-colors press-scale">
              Schedule a meeting
            </Link>
          </div>
        ) : (
          <div className="relative border-l border-border ml-3 pl-6 flex flex-col gap-8">
            {todaysMeetings.map((session) => {
              const status = getMeetingStatus(session);
              const start = parseISO(session.scheduledAt);
              const isJoining = joinMutation.isPending && joinMutation.variables === session.id;

              return (
                <div key={session.id} className="relative group">
                  <div
                    className="absolute -left-[30.5px] top-1.5 h-3 w-3 rounded-full border-2 border-background z-10 transition-transform group-hover:scale-125"
                    style={{
                      background: status === "live" ? "var(--destructive)" : "hsl(270 80% 60%)",
                      boxShadow: status === "live" ? "0 0 10px var(--destructive)" : "0 0 10px hsl(270 80% 60%)"
                    }}
                  />
                  <div className="flex flex-col gap-1 p-3 -mt-3 -ml-3 rounded-xl border border-transparent hover:border-border hover:bg-muted/20 transition-all">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                      <span className="text-foreground">{format(start, "h:mm a")}</span>
                      <span className="opacity-50">•</span>
                      <span>{session.durationMinutes}m</span>
                      {status === "live" && (
                        <>
                          <span className="opacity-50">•</span>
                          <span className="text-destructive flex items-center gap-1.5 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">
                            <span className="h-1.5 w-1.5 rounded-full bg-destructive inline-block animate-pulse" />
                            LIVE NOW
                          </span>
                        </>
                      )}
                    </div>
                    <h4 className="m-0 text-sm font-bold text-foreground tracking-tight">{session.title}</h4>
                    <p className="m-0 text-xs text-muted-foreground font-medium">{session.courseId}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-border px-2 py-1 rounded-md">
                        <Users className="w-3 h-3" />
                        <span>Live class</span>
                      </div>
                      {status === "live" ? (
                        <button
                          disabled={isJoining}
                          onClick={() => joinMutation.mutate(session.id)}
                          className={`ml-auto flex items-center gap-1.5 h-8 px-3 text-xs font-bold bg-destructive text-destructive-foreground border-none rounded-lg cursor-pointer shadow-[0_4px_12px_rgba(239,68,68,0.3)] hover:shadow-[0_4px_16px_rgba(239,68,68,0.5)] transition-all press-scale ${isJoining ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          {isJoining ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Video className="w-3.5 h-3.5" />
                          )}
                          Join Call
                        </button>
                      ) : (
                        <Link
                          href="/teacher/meetings"
                          className="ml-auto inline-flex items-center h-8 px-3 text-xs font-semibold bg-transparent text-foreground border border-border rounded-lg no-underline hover:bg-muted transition-colors press-scale"
                        >
                          Details
                        </Link>
                      )}
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
