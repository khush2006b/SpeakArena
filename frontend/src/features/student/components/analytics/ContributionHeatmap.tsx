"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/services/api/client";
import { Skeleton } from "@/components/ui/skeleton";

export interface ActivityDay {
  date: string;
  count: number;
  level: number;
}

export function ContributionHeatmap() {
  const [data, setData] = React.useState<ActivityDay[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadData() {
      try {
        await apiClient.get('/api/v1/profile');
        // Generate 365 days of empty data, or map real data if available
        const days: ActivityDay[] = [];
        const today = new Date();
        for (let i = 365; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          days.push({
            date: d.toISOString().split('T')[0],
            count: 0,
            level: 0
          });
        }
        setData(days);
      } catch (error) {
        console.error("Failed to load profile", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getColorClass = (level: number) => {
    switch (level) {
      case 4: return "bg-primary";
      case 3: return "bg-primary/80";
      case 2: return "bg-primary/60";
      case 1: return "bg-primary/40";
      default: return "bg-muted";
    }
  };

  if (loading) {
    return <Skeleton className="h-[200px] w-full rounded-[18px]" />;
  }

  // Group data into weeks for rendering (7 days per column)
  const weeks: ActivityDay[][] = [];
  let currentWeek: ActivityDay[] = [];
  
  data.forEach((day, index) => {
    currentWeek.push(day);
    if (currentWeek.length === 7 || index === data.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  return (
    <Card className="p-6 bg-card border-border rounded-[18px]">
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <div>
          <h3 className="text-lg font-extrabold text-foreground m-0">Learning Calendar</h3>
          <p className="text-sm text-muted-foreground m-0 mt-1">Track your daily learning consistency</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map(level => (
              <div key={level} className={`w-3 h-3 rounded-sm ${getColorClass(level)}`} />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-1 min-w-max">
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col gap-1">
              {week.map((day) => (
                <div 
                  key={day.date}
                  title={`${day.count} activities on ${day.date}`}
                  className={`w-3.5 h-3.5 rounded-sm cursor-pointer ${getColorClass(day.level)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
