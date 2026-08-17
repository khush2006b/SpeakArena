"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Video, Calendar, Clock, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { apiClient } from "@/services/api/client";

interface TodayScheduleProps {
  onJoinClick: (liveClass: any) => void;
  meetings: any[];
}

export function TodaySchedule({ onJoinClick, meetings }: TodayScheduleProps) {
  // Find next or current class
  const nextClass = meetings.find(
    (c) => c.status === "SCHEDULED" || c.status === "LIVE"
  );

  const [countdown, setCountdown] = React.useState<string>("");
  const [attendance, setAttendance] = React.useState({ percentage: 0, present: 0, late: 0, absent: 0 });
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const res = await apiClient.get('/api/v1/meetings?page=1&page_size=50');
        const items = res.data?.items ?? res.data?.data ?? res.data ?? [];
        
        let present = 0, late = 0, absent = 0;
        items.forEach((m: any) => {
          const status = m.attendance_status?.toUpperCase();
          if (status === 'PRESENT') present++;
          else if (status === 'LATE') late++;
          else if (status === 'ABSENT') absent++;
        });

        const total = present + late + absent;
        const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
        setAttendance({ percentage, present, late, absent });
      } catch (error) {
        // Ignore error and use default 0s
      } finally {
        setIsLoading(false);
      }
    };
    fetchAttendance();
  }, []);

  React.useEffect(() => {
    if (!nextClass || nextClass.status === "LIVE") return;

    const target = parseISO(nextClass.scheduledAt).getTime();

    const updateCountdown = () => {
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setCountdown("Starting now...");
        return;
      }

      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      if (h > 0) setCountdown(`Starts in ${h}h ${m}m`);
      else setCountdown(`Starts in ${m}m ${s}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextClass]);

  if (!nextClass) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

      {/* Hero Banner for Next Class */}
      <div className="card-glass hover-lift lg:col-span-2 overflow-hidden relative bg-gradient-to-br from-primary/20 via-card to-card">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none hidden sm:block">
          <Video className="w-48 h-48 text-primary" />
        </div>

        <div className="p-6 md:p-8 relative z-10 flex flex-col h-full">
          <div className="flex items-center gap-2 mb-4">
            {nextClass.status === "LIVE" ? (
              <span className="bg-red-500/90 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded shadow-sm flex items-center gap-1.5 animate-pulse">
                <span className="h-1.5 w-1.5 bg-white rounded-full" /> Live Now
              </span>
            ) : (
              <span className="bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                Up Next
              </span>
            )}
            {nextClass.status === "SCHEDULED" && countdown && (
              <span className="text-sm font-medium text-muted-foreground font-mono bg-secondary/50 px-2 py-0.5 rounded border border-border/50">
                {countdown}
              </span>
            )}
          </div>

          <h2 className="text-responsive-lg font-extrabold tracking-tight text-foreground mb-2">
            {nextClass.title}
          </h2>
          <p className="text-sm font-medium text-primary mb-6">Course Session</p>

          <div className="flex flex-wrap items-center gap-6 mb-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Today</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>
                {format(parseISO(nextClass.scheduledAt), "h:mm a")} (
                {nextClass.durationMinutes} min)
              </span>
            </div>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-4">
            <Button
              size="lg"
              className={`btn-primary press-scale font-semibold shadow-xl ${
                nextClass.status === "LIVE"
                  ? "bg-red-500 hover:bg-red-600 shadow-red-500/20"
                  : ""
              }`}
              onClick={() => onJoinClick(nextClass)}
            >
              <Video className="mr-2 h-4 w-4" />
              {nextClass.status === "LIVE"
                ? "Join Class Now"
                : "Pre-flight Check"}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="hidden sm:flex bg-card/50 backdrop-blur border-border press-scale"
            >
              <Calendar className="mr-2 h-4 w-4" /> Add to Calendar
            </Button>
          </div>
        </div>
      </div>

      {/* Attendance Summary */}
      <div className="card-glass hover-lift lg:col-span-1 p-6 flex flex-col">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-6">
          Attendance Overview
        </h3>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : (attendance.present + attendance.late + attendance.absent) === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm">No attendance records yet.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 flex flex-col items-center justify-center mb-6">
              <div className="relative h-32 w-32 flex items-center justify-center">
                <svg className="absolute inset-0 transform -rotate-90 w-full h-full">
                  <circle
                    className="text-secondary"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                    r="56"
                    cx="64"
                    cy="64"
                  />
                  <motion.circle
                    className="text-emerald-500"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 56}
                    initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                    animate={{
                      strokeDashoffset:
                        2 * Math.PI * 56 * (1 - attendance.percentage / 100),
                    }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    stroke="currentColor"
                    fill="transparent"
                    r="56"
                    cx="64"
                    cy="64"
                  />
                </svg>
                <div className="text-center">
                  <span className="text-3xl font-bold text-foreground">
                    {attendance.percentage}%
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center border-t border-border/40 pt-4">
              <div className="flex flex-col">
                <span className="text-xl font-semibold text-emerald-500">
                  {attendance.present}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Present
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-semibold text-amber-500">
                  {attendance.late}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Late
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-semibold text-rose-500">
                  {attendance.absent}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Absent
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
