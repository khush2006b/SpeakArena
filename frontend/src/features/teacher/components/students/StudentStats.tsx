"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Users, UserCheck, UserX, TrendingUp, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeacherStudents, useTeacherKPIs } from "@/hooks/queries/useTeacherQueries";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export function StudentStats() {
  const { data: studentsData, isLoading: isLoadingStudents } = useTeacherStudents({ page: 1, pageSize: 100 });
  const { data: kpis } = useTeacherKPIs();

  const students = studentsData?.items ?? [];
  // Use the server-reported total (not items.length which is page-limited)
  const totalStudents = studentsData?.total ?? students.length;
  const activeCount = kpis?.activeCount ?? students.filter((s) => s.status === "ACTIVE").length;
  const suspendedCount = kpis?.suspendedCount ?? students.filter((s) => s.status === "SUSPENDED" || s.status === "INACTIVE").length;
  const avgProgress = students.length > 0
    ? Math.round(students.reduce((acc, s) => acc + (s.progressPercent || 0), 0) / students.length)
    : 0;
  const totalRevenue = kpis?.totalRevenue ?? students.reduce((acc, s) => acc + (s.totalRevenue || 0), 0);

  const stats = [
    {
      title: "Total Students",
      value: isLoadingStudents ? "..." : totalStudents.toLocaleString(),
      subtitle: "Enrolled in your courses",
      icon: Users,
      color: "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]",
      bgColor: "bg-blue-500/10 ring-1 ring-blue-500/30",
    },
    {
      title: "Active Students",
      value: isLoadingStudents ? "..." : activeCount.toLocaleString(),
      subtitle: "Active enrollments",
      icon: UserCheck,
      color: "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]",
      bgColor: "bg-emerald-500/10 ring-1 ring-emerald-500/30",
    },
    {
      title: "Inactive / Suspended",
      value: isLoadingStudents ? "..." : suspendedCount.toLocaleString(),
      subtitle: "Requires attention",
      icon: UserX,
      color: "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]",
      bgColor: "bg-red-500/10 ring-1 ring-red-500/30",
    },
    {
      title: "Avg. Completion",
      value: isLoadingStudents ? "..." : `${avgProgress}%`,
      subtitle: "Across all courses",
      icon: TrendingUp,
      color: "text-[hsl(270,80%,60%)] drop-shadow-[0_0_8px_hsla(270,80%,60%,0.5)]",
      bgColor: "bg-[hsl(270,80%,60%)]/10 ring-1 ring-[hsl(270,80%,60%)]/30",
    },
    {
      title: "Total Revenue",
      value: isLoadingStudents ? "..." : `$${totalRevenue.toLocaleString()}`,
      subtitle: "Lifetime generated",
      icon: DollarSign,
      color: "text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]",
      bgColor: "bg-orange-500/10 ring-1 ring-orange-500/30",
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 mb-8"
    >
      {stats.map((stat) => (
        <motion.div key={stat.title} variants={itemVariants} className="h-full">
          <div className="card-glass hover-lift border border-border rounded-2xl p-6 transition-all duration-300 group h-full flex flex-col justify-between relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className={cn("absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl opacity-20 pointer-events-none", stat.bgColor)} />

            <div className="flex flex-col gap-4 relative z-10">
              <div className="flex items-start justify-between">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-500 group-hover:scale-110 shrink-0 shadow-[inset_0_1px_1px_hsl(var(--border))]", 
                  stat.bgColor
                )}>
                  <stat.icon className={cn("h-[18px] w-[18px]", stat.color)} />
                </div>
              </div>
              <div>
                <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground drop-shadow-sm m-0">{stat.value}</h2>
                <div className="pt-2 mt-2 border-t border-border">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground m-0">{stat.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-semibold opacity-80 m-0 line-clamp-1">{stat.subtitle}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
