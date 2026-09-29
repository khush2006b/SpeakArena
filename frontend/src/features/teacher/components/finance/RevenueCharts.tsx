"use client";

import * as React from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceSummary } from "@/hooks/queries/useTeacherQueries";
import { useFinanceStore } from "@/stores/finance.store";
import { TrendingUp } from "lucide-react";

export default function RevenueCharts() {
  const { dateRange, currency: storeCurrency } = useFinanceStore();
  const { data: summary, isLoading } = useFinanceSummary(dateRange, storeCurrency);
  const currencySymbol = storeCurrency === "USD" ? "$" : "₹";

  const rawTrends = summary?.trends ?? [];
  const chartData = rawTrends.length > 0
    ? rawTrends.map((t: any) => ({
        date: t.date || "Today",
        revenue: Number(t.revenue ?? t.amount ?? 0),
        students: Number(t.students ?? 1),
      }))
    : [
        { date: "Day 1", revenue: 0, students: 0 },
        { date: "Current", revenue: summary?.totalRevenue || 0, students: 1 },
      ];

  return (
    <div className="card-glass hover-lift h-full flex flex-col animate-fade-up">
      <div className="px-6 pt-6 pb-2">
        <h3 className="text-foreground font-extrabold text-base tracking-tight flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Revenue Trend
        </h3>
        <p className="text-muted-foreground text-sm mt-1">Verified earnings time series</p>
      </div>
      <div className="flex-1 px-6 pb-6">
        <div className="h-[300px] w-full">
          {isLoading ? (
            <Skeleton className="w-full h-full bg-white/5 rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                  tickFormatter={(value) => `${currencySymbol}${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "10px",
                    color: "hsl(var(--foreground))",
                  }}
                  itemStyle={{ color: "hsl(var(--foreground))", fontWeight: 700 }}
                  formatter={(value: any) => [`${currencySymbol}${Number(value).toLocaleString()}`, "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
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
