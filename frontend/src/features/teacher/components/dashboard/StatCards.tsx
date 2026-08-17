"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Users, DollarSign, Presentation, TrendingUp, Loader2 } from "lucide-react";
import { useTeacherKPIs } from "@/hooks/queries/useTeacherQueries";

const STAT_CONFIG = [
  {
    key: "revenue" as const,
    title: "Today's Revenue",
    icon: DollarSign,
    color: "hsl(270 80% 60%)",
    bgColor: "hsla(270, 80%, 60%, 0.15)",
    format: (kpis: ReturnType<typeof useTeacherKPIs>["data"]) =>
      kpis ? `$${kpis.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—",
    change: (kpis: ReturnType<typeof useTeacherKPIs>["data"]) =>
      kpis
        ? `${kpis.revenueChangePercent >= 0 ? "+" : ""}${kpis.revenueChangePercent.toFixed(1)}%`
        : "—",
    trend: (kpis: ReturnType<typeof useTeacherKPIs>["data"]) =>
      kpis && kpis.revenueChangePercent >= 0 ? "up" : "down",
  },
  {
    key: "students" as const,
    title: "Total Students",
    icon: Users,
    color: "hsl(270 80% 60%)",
    bgColor: "hsla(270, 80%, 60%, 0.15)",
    format: (kpis: ReturnType<typeof useTeacherKPIs>["data"]) =>
      kpis ? kpis.totalStudents.toLocaleString() : "—",
    change: (kpis: ReturnType<typeof useTeacherKPIs>["data"]) =>
      kpis ? `+${kpis.newStudentsThisMonth} this month` : "—",
    trend: () => "up" as const,
  },
  {
    key: "courses" as const,
    title: "Active Courses",
    icon: Presentation,
    color: "hsl(270 80% 60%)",
    bgColor: "hsla(270, 80%, 60%, 0.15)",
    format: (kpis: ReturnType<typeof useTeacherKPIs>["data"]) =>
      kpis ? String(kpis.activeCourses) : "—",
    change: (kpis: ReturnType<typeof useTeacherKPIs>["data"]) =>
      kpis ? `${kpis.draftCourses} draft${kpis.draftCourses !== 1 ? "s" : ""}` : "—",
    trend: () => "neutral" as const,
  },
  {
    key: "attendance" as const,
    title: "Attendance Rate",
    icon: TrendingUp,
    color: "hsl(270 80% 60%)",
    bgColor: "hsla(270, 80%, 60%, 0.15)",
    format: (kpis: ReturnType<typeof useTeacherKPIs>["data"]) =>
      kpis ? `${kpis.attendanceRate.toFixed(1)}%` : "—",
    change: (kpis: ReturnType<typeof useTeacherKPIs>["data"]) =>
      kpis
        ? `${kpis.attendanceChangePercent >= 0 ? "+" : ""}${kpis.attendanceChangePercent.toFixed(1)}%`
        : "—",
    trend: (kpis: ReturnType<typeof useTeacherKPIs>["data"]) =>
      kpis && kpis.attendanceChangePercent >= 0 ? "up" : "down",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export function StatCards() {
  const { data: kpis, isLoading } = useTeacherKPIs();

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8"
    >
      {STAT_CONFIG.map((stat) => (
        <motion.div key={stat.key} variants={itemVariants} className="h-full">
          <div className="card-glass card-stat hover-lift p-4 sm:p-6 h-full flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground m-0">
                  {stat.title}
                </p>
                <div className="flex items-baseline gap-2">
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                  ) : (
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground m-0 tracking-tight">
                      {stat.format(kpis)}
                    </h2>
                  )}
                </div>
              </div>
              <div
                className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
                style={{ background: stat.bgColor }}
              >
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold border-t border-border pt-4">
              <span
                className={
                  stat.trend(kpis) === "up" ? "text-chart-1" : stat.trend(kpis) === "down" ? "text-destructive" : "text-muted-foreground"
                }
              >
                {isLoading ? "—" : stat.change(kpis)}
              </span>
              <span className="ml-2 text-muted-foreground">vs last period</span>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
