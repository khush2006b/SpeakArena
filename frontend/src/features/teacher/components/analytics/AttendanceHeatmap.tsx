"use client";

import * as React from "react";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { cn } from "@/lib/utils";

// Generate 365 days of mock attendance intensity
const generateHeatmapData = () => {
  const today = new Date();
  const startDate = subDays(today, 364);
  const days = eachDayOfInterval({ start: startDate, end: today });
  
  return days.map(date => {
    // Random intensity 0-4
    const intensity = Math.floor(Math.random() * 5);
    return {
      date,
      intensity,
      count: intensity * 12
    };
  });
};

const HEATMAP_DATA = generateHeatmapData();

const WEEKS = 52;
const DAYS_IN_WEEK = 7;

function getIntensityColor(intensity: number) {
  switch(intensity) {
    case 0: return "bg-white/5 hover:bg-white/10"; // No activity
    case 1: return "bg-primary/30 hover:bg-primary/40 shadow-[0_0_8px_rgba(var(--primary-rgb),0.1)]";
    case 2: return "bg-primary/50 hover:bg-primary/60 shadow-[0_0_8px_rgba(var(--primary-rgb),0.2)]";
    case 3: return "bg-primary/70 hover:bg-primary/80 shadow-[0_0_10px_rgba(var(--primary-rgb),0.4)]";
    case 4: return "bg-primary hover:bg-primary shadow-[0_0_12px_rgba(var(--primary-rgb),0.6)]";
    default: return "bg-white/5";
  }
}

export default function AttendanceHeatmap() {
  // Group data into weeks
  const weeks = Array.from({ length: WEEKS }).map((_, weekIndex) => {
    return Array.from({ length: DAYS_IN_WEEK }).map((_, dayIndex) => {
      const dataIndex = weekIndex * DAYS_IN_WEEK + dayIndex;
      return HEATMAP_DATA[dataIndex];
    });
  });

  return (
    <div className="elevation-1 rounded-2xl bg-white/[0.01] overflow-hidden w-full transition-all duration-300 hover:elevation-2 border border-transparent hover:border-white/5">
      <div className="p-5 border-b border-white/5">
        <h3 className="text-lg font-extrabold tracking-tight text-foreground flex items-center gap-2">Yearly Attendance Map</h3>
        <p className="text-xs font-semibold text-muted-foreground opacity-70 mt-1">Daily cohort activity and participation across all courses</p>
      </div>
      <div className="p-5">
        <div className="flex w-full overflow-x-auto pb-4 hide-scrollbar">
          <div className="min-w-max flex gap-[4px] p-1">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-[4px]">
                {week.map((day, dayIndex) => {
                  if (!day) return <div key={dayIndex} className="w-[12px] h-[12px] bg-transparent rounded-sm" />;
                  
                  return (
                    <div 
                      key={dayIndex} 
                      className={cn(
                        "w-[12px] h-[12px] rounded-sm transition-all duration-200 cursor-pointer hover:scale-110",
                        getIntensityColor(day.intensity)
                      )}
                      title={`${format(day.date, "MMM d, yyyy")}: ${day.count} active students`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-3 mt-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-[4px]">
            <div className="w-[12px] h-[12px] rounded-sm bg-white/5" />
            <div className="w-[12px] h-[12px] rounded-sm bg-primary/30" />
            <div className="w-[12px] h-[12px] rounded-sm bg-primary/50" />
            <div className="w-[12px] h-[12px] rounded-sm bg-primary/70" />
            <div className="w-[12px] h-[12px] rounded-sm bg-primary" />
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
