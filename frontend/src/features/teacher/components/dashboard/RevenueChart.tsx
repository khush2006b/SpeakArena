"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Loader2 } from "lucide-react";
import { useRevenueTrends } from "@/hooks/queries/useTeacherQueries";

type Period = "week" | "month" | "year";

export function RevenueChart() {
  const [period, setPeriod] = React.useState<Period>("month");
  const { data, isLoading } = useRevenueTrends(period);

  return (
    <div className="card-glass hover-lift rounded-2xl bg-card border border-border p-4 flex flex-col gap-3 relative overflow-hidden h-full">
      {/* Ambient background glow */}
      <div 
        className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] opacity-10 pointer-events-none"
        style={{ background: "hsl(270 80% 60%)" }}
      />
      
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 relative z-10">
        <div className="flex flex-col gap-1">
          <h3 className="m-0 text-lg font-extrabold text-foreground tracking-tight">Revenue & Growth</h3>
          <p className="m-0 text-sm text-muted-foreground">
            {period === "week" ? "7-day" : period === "month" ? "Monthly" : "Yearly"} overview of platform earnings.
          </p>
        </div>
        <div className="flex p-1 gap-1 bg-muted/50 border border-border rounded-xl">
          {(["week", "month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`border-none rounded-lg px-3 py-1.5 text-xs font-semibold capitalize cursor-pointer transition-all press-scale ${
                period === p ? "bg-card text-[hsl(270,80%,60%)] shadow-sm" : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[260px] w-full mt-2 relative z-10">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={Array.isArray(data) ? data : (data as any)?.data_points || []}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(270 80% 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(270 80% 60%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
                strokeOpacity={0.4}
              />
              <XAxis
                dataKey="date"
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                dx={-10}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderRadius: "12px",
                  border: "1px solid hsl(var(--border))",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
                  color: "hsl(var(--foreground))",
                  padding: "12px 16px"
                }}
                itemStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: "4px" }}
                formatter={(value: any, name: any) => [
                  name === "revenue" ? `$${value.toLocaleString()}` : value,
                  name === "revenue" ? "Revenue" : "Students",
                ]}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(270 80% 60%)"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorRevenue)"
                activeDot={{ r: 6, strokeWidth: 0, fill: "hsl(270 80% 60%)", style: { filter: "drop-shadow(0 0 8px hsla(270,80%,60%,0.8))" } }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
