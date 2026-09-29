"use client";

import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceSummary } from "@/hooks/queries/useTeacherQueries";
import { useFinanceStore } from "@/stores/finance.store";

const DEFAULT_DATA = [
  { name: "Successful", value: 100, color: "#10b981", count: 0 },
  { name: "Pending", value: 0, color: "#f59e0b", count: 0 },
  { name: "Failed", value: 0, color: "#ef4444", count: 0 },
  { name: "Refunded", value: 0, color: "#6b7280", count: 0 },
];

export default function PaymentDistribution() {
  const { dateRange, currency: storeCurrency } = useFinanceStore();
  const { data: summary, isLoading } = useFinanceSummary(dateRange, storeCurrency);

  const rawDist = summary?.distribution && summary.distribution.length > 0 ? summary.distribution : DEFAULT_DATA;
  const successItem = rawDist.find((d: any) => d.name === "Successful") || rawDist[0];
  const successPercent = successItem?.value ?? 100;

  return (
    <div className="card-glass hover-lift h-full flex flex-col animate-fade-up">
      <div className="px-6 pt-6 pb-2">
        <h3 className="text-foreground font-extrabold text-base tracking-tight">Payment Status</h3>
        <p className="text-muted-foreground text-sm mt-1">Breakdown of all transaction states</p>
      </div>
      <div className="flex-1 flex flex-col justify-between px-6 pb-6">
        <div className="h-[200px] w-full relative">
          {isLoading ? (
            <Skeleton className="w-full h-full rounded-full bg-white/5" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rawDist}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {rawDist.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "10px",
                    color: "hsl(var(--foreground))",
                  }}
                  itemStyle={{ color: "hsl(var(--foreground))", fontWeight: 700 }}
                  formatter={(value) => [`${value}%`, undefined]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
            <span className="text-foreground text-3xl font-black">{successPercent}%</span>
            <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Success Rate</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-6">
          {rawDist.map((item: any, i: number) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground text-sm font-medium">{item.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.count !== undefined && item.count > 0 && (
                  <span className="text-xs text-muted-foreground font-mono">({item.count})</span>
                )}
                <span className="text-foreground text-sm font-bold">{item.value}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
