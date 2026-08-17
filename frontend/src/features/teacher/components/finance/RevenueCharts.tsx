"use client";

import * as React from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useRevenueTrends } from "@/hooks/queries/useTeacherQueries";
import { useFinanceStore } from "@/stores/finance.store";

export default function RevenueCharts() {
  const { currency } = useFinanceStore();
  const { data: trends, isLoading } = useRevenueTrends("month");
  const currencySymbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";

  return (
    <div className="card-glass hover-lift h-full flex flex-col animate-fade-up">
      <div className="px-6 pt-6 pb-2">
        <h3 className="text-foreground font-extrabold text-base tracking-tight">Revenue Trend</h3>
        <p className="text-muted-foreground text-sm mt-1">Actual revenue vs forecasted targets</p>
      </div>
      <div className="flex-1 px-6 pb-6">
        <div className="h-[300px] w-full">
          {isLoading ? (
            <Skeleton className="w-full h-full bg-white/5 rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.5)" />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${currencySymbol}${value / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "10px",
                    color: "hsl(var(--foreground))",
                  }}
                  itemStyle={{ color: "hsl(var(--foreground))", fontWeight: 700 }}
                  formatter={(value: any) => [`${currencySymbol}${Number(value).toLocaleString()}`, undefined]}
                />
                {trends && trends.length > 0 && trends[0].target !== undefined && (
                  <Area
                    type="monotone"
                    dataKey="target"
                    name="Forecast"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fillOpacity={0}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Actual Revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
