"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { generateHeatmapData, ActivityDay } from "../../constants/analytics.mock";

export function ContributionHeatmap() {
  const [data, setData] = React.useState<ActivityDay[]>([]);

  React.useEffect(() => {
    // Generate data on mount to avoid hydration mismatch with dates
    setData(generateHeatmapData());
  }, []);

  const getColor = (level: number) => {
    switch (level) {
      case 4: return "#4f46e5";
      case 3: return "rgba(79,70,229,0.7)";
      case 2: return "rgba(79,70,229,0.5)";
      case 1: return "rgba(79,70,229,0.3)";
      default: return "rgba(255,255,255,0.05)";
    }
  };

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
    <Card style={{ padding: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', margin: 0 }}>Learning Calendar</h3>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0, marginTop: '4px' }}>423 lessons completed in the last year</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#9ca3af' }}>
          <span>Less</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[0, 1, 2, 3, 4].map(level => (
              <div key={level} style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: getColor(level) }} />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', gap: '4px', minWidth: 'max-content' }}>
          {weeks.map((week, wIdx) => (
            <div key={wIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {week.map((day) => (
                <div 
                  key={day.date}
                  title={`${day.count} activities on ${day.date}`}
                  style={{ 
                    width: '14px', 
                    height: '14px', 
                    borderRadius: '4px', 
                    backgroundColor: getColor(day.level),
                    cursor: 'pointer'
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
