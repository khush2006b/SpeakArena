"use client";

import * as React from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import { MOCK_TOPIC_DATA } from "../../constants/analytics.mock";

export function TopicRadarChart() {
  // To avoid hydration mismatch with recharts ResponsiveContainer
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => setIsMounted(true), []);

  if (!isMounted) {
    return <Card style={{ padding: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px', height: '350px' }} />;
  }

  return (
    <Card style={{ padding: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '18px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, marginBottom: '8px' }}>Skill Mastery</h3>
      <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0, marginBottom: '16px' }}>Your proficiency across different computer science topics.</p>
      
      <div style={{ flex: 1, minHeight: '250px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={MOCK_TOPIC_DATA}>
            <PolarGrid stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
            <PolarAngleAxis 
              dataKey="topic" 
              tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 500 }}
            />
            <PolarRadiusAxis 
              angle={30} 
              domain={[0, 100]} 
              tick={false}
              axisLine={false} 
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#080c14', borderColor: 'rgba(255,255,255,0.07)', borderRadius: '8px', color: '#fff' }}
              itemStyle={{ color: '#4f46e5' }}
            />
            <Radar
              name="Mastery %"
              dataKey="mastery"
              stroke="#4f46e5"
              fill="#4f46e5"
              fillOpacity={0.3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
