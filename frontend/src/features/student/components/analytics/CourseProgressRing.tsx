"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/services/api/client";
import { Skeleton } from "@/components/ui/skeleton";

interface RingProps {
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
}

function ProgressRing({ progress, size, strokeWidth, color }: RingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <svg style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }} width={size} height={size}>
        <circle
          className="text-muted/20"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <svg style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }} width={size} height={size}>
        <motion.circle
          style={{ color }}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
        />
      </svg>
    </div>
  );
}

export function CourseProgressRing() {
  const [courses, setCourses] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadData() {
      try {
        const res = await apiClient.get('/api/v1/courses?enrolled=true&page=1&page_size=4');
        setCourses(res.data.items || res.data.courses || []);
      } catch (err) {
        console.error("Failed to load courses", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return <Skeleton className="h-[300px] w-full rounded-[18px]" />;
  }

  if (courses.length === 0) {
    return (
      <Card className="p-6 bg-card border-border rounded-[18px] flex flex-col items-center justify-center h-full">
        <p className="text-muted-foreground text-sm">No enrolled courses yet.</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-card border-border rounded-[18px] flex flex-col h-full overflow-hidden">
      <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-6 text-center">Course Progress</h3>
      
      <div className="flex flex-col gap-6 w-full flex-1 justify-center">
        {courses.slice(0, 4).map((course, idx) => (
          <div key={course.id || idx} className="flex items-center gap-4">
            <div className="relative flex items-center justify-center shrink-0">
              <ProgressRing progress={course.progress || 0} size={60} strokeWidth={6} color="hsl(var(--primary))" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-foreground">{course.progress || 0}%</span>
              </div>
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold text-foreground truncate">{course.title}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
