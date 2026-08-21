"use client";

import * as React from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/services/api/client";
import { Skeleton } from "@/components/ui/skeleton";

export function TopicRadarChart() {
  const [isMounted, setIsMounted] = React.useState(false);
  const [data, setData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setIsMounted(true);
    async function loadData() {
      try {
        const response = await apiClient.get('/api/v1/profile');
        const scores = response.data.skills || {};
        setData([
          { topic: "Pronunciation", mastery: scores.pronunciation || 0 },
          { topic: "Fluency", mastery: scores.fluency || 0 },
          { topic: "Vocabulary", mastery: scores.vocabulary || 0 },
          { topic: "Grammar", mastery: scores.grammar || 0 },
          { topic: "Listening", mastery: scores.listening || 0 },
          { topic: "Confidence", mastery: scores.confidence || 0 },
        ]);
      } catch (error) {
        console.error("Failed to load skills", error);
        setData([
          { topic: "Pronunciation", mastery: 0 },
          { topic: "Fluency", mastery: 0 },
          { topic: "Vocabulary", mastery: 0 },
          { topic: "Grammar", mastery: 0 },
          { topic: "Listening", mastery: 0 },
          { topic: "Confidence", mastery: 0 },
        ]);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (!isMounted || loading) {
    return <Skeleton className="h-[350px] w-full rounded-[18px]" />;
  }

  return (
    <Card className="p-6 bg-card border-border rounded-[18px] flex flex-col h-full">
      <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider m-0 mb-2">Skill Mastery</h3>
      <p className="text-xs text-muted-foreground m-0 mb-4">Your English skills radar across key speaking dimensions.</p>
      
      <div className="flex-1 min-h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <PolarAngleAxis 
              dataKey="topic" 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
            />
            <PolarRadiusAxis 
              angle={30} 
              domain={[0, 100]} 
              tick={false}
              axisLine={false} 
            />
            <Tooltip 
              contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
              itemStyle={{ color: 'hsl(var(--primary))' }}
            />
            <Radar
              name="Mastery %"
              dataKey="mastery"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
