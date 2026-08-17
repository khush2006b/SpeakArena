"use client";

import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";


const data = [
  { name: "Present", value: 75, color: "hsl(var(--emerald-500))" },
  { name: "Late", value: 15, color: "hsl(var(--orange-500))" },
  { name: "Absent", value: 10, color: "hsl(var(--destructive))" },
];

export default function AnalyticsStats() {
  return (
    <div className="elevation-1 rounded-2xl bg-white/[0.01] h-full flex flex-col overflow-hidden relative group transition-all duration-300 hover:elevation-2 border border-transparent hover:border-white/5">
      <div className="absolute top-0 right-0 h-32 w-32 bg-primary/5 rounded-full blur-3xl -z-10 group-hover:bg-primary/10 transition-colors duration-500" />
      <div className="p-5 border-b border-white/5">
        <h3 className="text-lg font-extrabold tracking-tight text-foreground flex items-center gap-2">Overall Engagement</h3>
      </div>
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div className="h-[200px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={85}
                paddingAngle={6}
                dataKey="value"
                stroke="none"
                cornerRadius={4}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} className="drop-shadow-md hover:drop-shadow-xl transition-all duration-300 outline-none" style={{ filter: `drop-shadow(0px 0px 8px ${entry.color}40)` }} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)", borderColor: "hsl(var(--border))", borderRadius: "12px", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                itemStyle={{ color: "hsl(var(--foreground))", fontWeight: "bold" }}
                cursor={false}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
            <span className="text-4xl font-extrabold tracking-tighter text-foreground drop-shadow-sm">85%</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">Active</span>
          </div>
        </div>

        <div className="space-y-4 mt-8">
          <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="text-sm font-semibold text-muted-foreground">Present</span>
            </div>
            <span className="text-sm font-bold">75%</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
              <span className="text-sm font-semibold text-muted-foreground">Late</span>
            </div>
            <span className="text-sm font-bold">15%</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              <span className="text-sm font-semibold text-muted-foreground">Absent</span>
            </div>
            <span className="text-sm font-bold text-red-400">10%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
