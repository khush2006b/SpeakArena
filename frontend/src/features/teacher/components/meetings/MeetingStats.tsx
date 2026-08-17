"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Users, CalendarCheck, CalendarX, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeacherMeetings } from "@/hooks/queries/useTeacherQueries";
import { isToday, parseISO, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export function MeetingStats() {
  const { data, isLoading } = useTeacherMeetings({ page: 1, pageSize: 100 });
  const meetings = data?.items ?? [];

  const now = new Date();
  const weekRange = {
    start: startOfWeek(now, { weekStartsOn: 1 }),
    end: endOfWeek(now, { weekStartsOn: 1 }),
  };

  const todayCount = meetings.filter((m) => {
    try { return isToday(parseISO(m.scheduledAt)); } catch { return false; }
  }).length;

  const liveCount = meetings.filter((m) => m.status === "LIVE").length;
  const upcomingTodayCount = meetings.filter((m) => m.status === "SCHEDULED" && (() => {
    try { return isToday(parseISO(m.scheduledAt)); } catch { return false; }
  })()).length;

  const weekMeetings = meetings.filter((m) => {
    try { return isWithinInterval(parseISO(m.scheduledAt), weekRange); } catch { return false; }
  });

  const upcomingWeekCount = weekMeetings.filter((m) => m.status === "SCHEDULED").length;
  const cancelledThisMonth = meetings.filter((m) => m.status === "CANCELLED").length;

  const completedWithAttendance = weekMeetings.filter(
    (m) => m.status === "ENDED" && (m as any).attendance,
  );
  const avgAttendance = completedWithAttendance.length > 0
    ? Math.round(
        completedWithAttendance.reduce((acc, m) => {
          if (!(m as any).attendance) return acc;
          return acc + ((m as any).attendance.present / (m as any).attendance.total) * 100;
        }, 0) / completedWithAttendance.length,
      )
    : 0;

  const STATS = [
    {
      title: "Today's Classes",
      value: isLoading ? "—" : String(todayCount),
      subtitle: isLoading ? "Loading…" : `${liveCount} live, ${upcomingTodayCount} upcoming`,
      icon: CalendarCheck,
      iconClass: "text-violet-400",
      iconBg: "bg-violet-500/15 ring-1 ring-violet-500/30",
      glowClass: "bg-violet-500/20",
    },
    {
      title: "Attendance Rate",
      value: isLoading ? "—" : `${avgAttendance}%`,
      subtitle: "Average this week",
      icon: Users,
      iconClass: "text-emerald-400",
      iconBg: "bg-emerald-500/15 ring-1 ring-emerald-500/30",
      glowClass: "bg-emerald-500/20",
      progress: avgAttendance,
      progressClass: "bg-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.8)]",
    },
    {
      title: "Upcoming Week",
      value: isLoading ? "—" : String(upcomingWeekCount),
      subtitle: "Scheduled sessions",
      icon: Activity,
      iconClass: "text-blue-400",
      iconBg: "bg-blue-500/15 ring-1 ring-blue-500/30",
      glowClass: "bg-blue-500/20",
    },
    {
      title: "Cancelled",
      value: isLoading ? "—" : String(cancelledThisMonth),
      subtitle: "This month",
      icon: CalendarX,
      iconClass: "text-red-400",
      iconBg: "bg-red-500/15 ring-1 ring-red-500/30",
      glowClass: "bg-red-500/20",
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid gap-4 grid-cols-2 md:grid-cols-4"
    >
      {STATS.map((stat) => (
        <motion.div key={stat.title} variants={itemVariants}>
          <div className="card-stat hover-lift group h-full flex flex-col justify-between relative overflow-hidden">
            {/* Ambient glow */}
            <div className={cn("absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl opacity-20", stat.glowClass)} />

            <div className="flex flex-col gap-4 relative z-10">
              <div className="flex items-start justify-between">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-500 group-hover:scale-110 shrink-0", stat.iconBg)}>
                  <stat.icon className={cn("h-5 w-5", stat.iconClass)} />
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-12 mt-1 bg-white/5" />
                ) : (
                  <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tighter text-foreground">{stat.value}</h2>
                )}
              </div>
              <div className="pt-2 mt-2 border-t border-border/50">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{stat.title}</p>
                <p className="text-xs text-muted-foreground mt-1 font-semibold opacity-70 line-clamp-1">{stat.subtitle}</p>
              </div>
            </div>

            {stat.progress !== undefined && !isLoading && (
              <div className="mt-5 relative z-10">
                <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-1000", stat.progressClass)}
                    style={{ width: `${stat.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
