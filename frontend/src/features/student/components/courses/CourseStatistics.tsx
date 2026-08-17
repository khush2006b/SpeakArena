"use client";

import * as React from "react";
import { BookOpen, CheckCircle2, Clock, PlayCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/services/api/client";

interface StatCard {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}

interface StudentCourseStats {
  total: number;
  inProgress: number;
  completed: number;
  hoursLearned: number;
}

export function CourseStatistics() {
  const [stats, setStats] = React.useState<StudentCourseStats | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    setIsLoading(true);
    apiClient
      .get("/api/v1/courses", { params: { page: 1, page_size: 100 } })
      .then((res) => {
        const raw = res.data;
        let items: any[] = [];
        if (Array.isArray(raw?.data)) items = raw.data;
        else if (Array.isArray(raw?.data?.items)) items = raw.data.items;
        else if (Array.isArray(raw)) items = raw;

        const total = items.length;
        const completed = items.filter(
          (c) => (c.progress_percentage ?? 0) >= 100
        ).length;
        const inProgress = items.filter(
          (c) =>
            (c.progress_percentage ?? 0) > 0 &&
            (c.progress_percentage ?? 0) < 100
        ).length;
        const totalLectures = items.reduce(
          (sum: number, c: any) => sum + (c.total_lectures ?? 0),
          0
        );
        const hoursLearned = Math.round((totalLectures * 20) / 60);

        setStats({ total, inProgress, completed, hoursLearned });
      })
      .catch(() => {
        setStats({ total: 0, inProgress: 0, completed: 0, hoursLearned: 0 });
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton
            key={i}
            className="h-24 w-full rounded-xl bg-card border border-border"
          />
        ))}
      </div>
    );
  }

  const cards: StatCard[] = [
    {
      title: "Enrolled Courses",
      value: stats?.total ?? 0,
      icon: BookOpen,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "In Progress",
      value: stats?.inProgress ?? 0,
      icon: PlayCircle,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      title: "Completed",
      value: stats?.completed ?? 0,
      icon: CheckCircle2,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Hours Learned",
      value: stats?.hoursLearned ?? 0,
      icon: Clock,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <Card
            key={idx}
            className="overflow-hidden group transition-colors hover:border-primary/30 card-glass hover-lift"
            style={{ borderRadius: 16 }}
          >
            <CardContent className="p-4 md:p-6 flex items-center gap-4">
              <div
                className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${stat.bg}`}
              >
                <Icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl leading-none text-foreground font-extrabold">
                  {stat.value}
                </span>
                <span className="text-sm mt-1 font-medium text-muted-foreground">
                  {stat.title}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
