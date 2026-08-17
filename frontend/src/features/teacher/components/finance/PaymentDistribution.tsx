"use client";

import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const data = [
  { name: "Successful", value: 85, color: "#10b981" },
  { name: "Pending", value: 10, color: "#f59e0b" },
  { name: "Failed", value: 3, color: "#ef4444" },
  { name: "Refunded", value: 2, color: "#6b7280" },
];

export default function PaymentDistribution() {
  return (
    <div className="card-glass hover-lift h-full flex flex-col animate-fade-up">
      <div className="px-6 pt-6 pb-2">
        <h3 className="text-foreground font-extrabold text-base tracking-tight">Payment Status</h3>
        <p className="text-muted-foreground text-sm mt-1">Breakdown of all transactions</p>
      </div>
      <div className="flex-1 flex flex-col justify-between px-6 pb-6">
        <div className="h-[200px] w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
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
          <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
            <span className="text-foreground text-3xl font-bold">85%</span>
            <span className="text-muted-foreground text-[11px] uppercase tracking-widest">Success</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-6">
          {data.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground text-sm font-medium">{item.name}</span>
              </div>
              <span className="text-foreground text-sm font-bold">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
