"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Library, FileEdit, Users, DollarSign } from "lucide-react";
import { useTeacherCourses } from "@/hooks/queries/useTeacherQueries";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

function StatCardSkeleton() {
  return (
    <div className="card-glass border border-border rounded-2xl p-6 h-full flex flex-col justify-between">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="h-10 w-10 rounded-xl bg-border animate-pulse" />
          <div className="h-8 w-16 rounded-md bg-border animate-pulse" />
        </div>
        <div className="flex flex-col gap-2 mt-4">
          <div className="h-3 w-28 rounded bg-border animate-pulse" />
          <div className="h-2 w-20 rounded bg-border animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function CourseStatsCards() {
  // Fetch all courses (large page_size so we can derive counts from real data)
  const { data: coursesData, isLoading } = useTeacherCourses({ page: 1, pageSize: 100 });

  const courses = coursesData?.items ?? [];
  const publishedCount = courses.filter((c) => c.status === "PUBLISHED").length;
  const draftCount = courses.filter((c) => c.status === "DRAFT").length;
  const totalStudents = courses.reduce((sum, c) => sum + (c.enrolledCount ?? 0), 0);
  const totalRevenue = courses.reduce((sum, c) => sum + ((c.price ?? 0) * (c.enrolledCount ?? 0)), 0);

  const STATS = [
    {
      title: "Published",
      value: String(publishedCount),
      sub: `${draftCount} draft${draftCount !== 1 ? "s" : ""}`,
      icon: Library,
    },
    {
      title: "Drafts",
      value: String(draftCount),
      sub: "Awaiting publish",
      icon: FileEdit,
    },
    {
      title: "Total Enrollments",
      value: totalStudents.toLocaleString(),
      sub: "Across all courses",
      icon: Users,
    },
    {
      title: "Est. Revenue",
      value: `₹${totalRevenue.toLocaleString()}`,
      sub: "Price × Enrollments",
      icon: DollarSign,
    },
  ];

  const color = "hsl(270 80% 60%)";
  const bg = "hsla(270, 80%, 60%, 0.15)";

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8"
    >
      {STATS.map((stat) => (
        <motion.div key={stat.title} variants={itemVariants} className="h-full">
          <div className="card-glass hover-lift border border-border rounded-2xl p-6 h-full flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl opacity-20 pointer-events-none" style={{ background: bg }} />
            <div className="flex flex-col gap-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: bg }}>
                  <stat.icon className="h-5 w-5" style={{ color }} />
                </div>
                <h2 className="m-0 text-2xl font-extrabold text-foreground tracking-tight">{stat.value}</h2>
              </div>
              <div className="pt-2 border-t border-border">
                <p className="m-0 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{stat.title}</p>
                <p className="m-0 mt-1 text-xs text-muted-foreground font-semibold opacity-80">{stat.sub}</p>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
