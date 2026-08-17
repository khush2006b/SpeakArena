"use client";

import * as React from "react";
import { Users, BookOpen, Video, Star } from "lucide-react";
import { useTeacherKPIs } from "@/hooks/queries/useTeacherQueries";
import { Skeleton } from "@/components/ui/skeleton";

export function AchievementCards() {
  const { data: kpis, isLoading } = useTeacherKPIs();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl bg-border/30" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: "Students Taught", value: (kpis?.totalStudents ?? 0).toLocaleString(), icon: Users, color: "text-blue-400", bg: "bg-blue-500/10 border border-blue-500/20" },
    { label: "Courses Published", value: kpis?.activeCourses ?? 0, icon: BookOpen, color: "text-emerald-400", bg: "bg-emerald-500/10 border border-emerald-500/20" },
    { label: "New Students", value: (kpis?.newStudentsThisMonth ?? 0).toLocaleString(), icon: Video, color: "text-violet-400", bg: "bg-violet-500/15 border border-violet-500/30" },
    { label: "Attendance Rate", value: `${Math.round(kpis?.attendanceRate ?? 0)}%`, icon: Star, color: "text-orange-400", bg: "bg-orange-500/10 border border-orange-500/20" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-5">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div key={i} className="card-glass hover-lift p-4 sm:p-5 flex flex-col items-center text-center justify-center gap-3 cursor-default group">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${card.bg} ${card.color} group-hover:scale-110 transition-transform`}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{card.value}</div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{card.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
