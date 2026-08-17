"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { apiClient } from "@/services/api/client";
import { Loader2 } from "lucide-react";

export default function TrendCharts() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      let res;
      try {
        res = await apiClient.get("/api/v1/teacher/analytics/revenue", { params: { period: "MONTHLY" } });
      } catch {
        res = await apiClient.get("/api/v1/teacher/dashboard");
      }
      const rawData = res?.data?.data?.revenue_trend || res?.data?.data || res?.data || [];
      setData(Array.isArray(rawData) ? rawData : []);
    } catch (err) {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="elevation-1 rounded-2xl bg-white/[0.01] h-full flex flex-col overflow-hidden relative group transition-all duration-300 hover:elevation-2 border border-transparent hover:border-white/5">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 bg-emerald-500/5 rounded-full blur-3xl -z-10 group-hover:bg-emerald-500/10 transition-colors duration-500" />
      <div className="p-5 border-b border-white/5">
        <h3 className="text-lg font-extrabold tracking-tight text-foreground flex items-center gap-2">Revenue & Watch Time Trends</h3>
        <p className="text-xs font-semibold text-muted-foreground opacity-70 mt-1">Metrics across the selected date range</p>
      </div>
      <div className="p-5 flex-1">
        <div className="h-[300px] w-full flex items-center justify-center">
          {loading ? (
             <Loader2 className="animate-spin h-8 w-8 text-primary" />
          ) : data.length === 0 ? (
             <div className="text-muted-foreground">No data available.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorWatchTime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--emerald-500))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--emerald-500))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} dx={-10} />
                <Tooltip
                  contentStyle={{ backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)", borderColor: "hsl(var(--border))", borderRadius: "12px", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                  itemStyle={{ color: "hsl(var(--foreground))", fontWeight: "bold" }}
                  cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1, strokeDasharray: "3 3" }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  name="Revenue ($)"
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                  style={{ filter: `drop-shadow(0px 4px 8px rgba(var(--primary-rgb),0.3))` }}
                />
                <Area 
                  type="monotone" 
                  dataKey="watchTime" 
                  name="Watch Time (mins)"
                  stroke="hsl(var(--emerald-500))" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorWatchTime)" 
                  style={{ filter: `drop-shadow(0px 4px 8px rgba(52,211,153,0.3))` }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
