"use client";

import * as React from "react";
import { Area, AreaChart, Bar, BarChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Cell } from "recharts";

const data = [
  { name: "Jan", students: 1200 },
  { name: "Feb", students: 1400 },
  { name: "Mar", students: 1600 },
  { name: "Apr", students: 1900 },
  { name: "May", students: 2400 },
  { name: "Jun", students: 2845 },
];

const attendanceData = [
  { month: "Jan", attendance: 85 },
  { month: "Feb", attendance: 88 },
  { month: "Mar", attendance: 92 },
  { month: "Apr", attendance: 87 },
  { month: "May", attendance: 95 },
  { month: "Jun", attendance: 97 },
];

const regionData = [
  { name: "North America", value: 4000 },
  { name: "Europe", value: 3000 },
  { name: "Asia", value: 2000 },
  { name: "Others", value: 1000 },
];

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--border))", "hsl(var(--muted))", "hsl(var(--accent))"];

export function StudentAnalytics() {
  return (
    <div className="grid gap-6 pb-24" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
      {/* Student Growth Chart */}
      <div
        className="card-glass overflow-hidden"
        style={{ gridColumn: "1 / -1" }}
      >
        <div className="px-6 py-5 border-b border-border/50">
          <h3 className="text-base font-extrabold text-foreground">Student Growth</h3>
        </div>
        <div className="p-6">
          <div style={{ height: "350px", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "10px" }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Area type="monotone" dataKey="students" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorStudents)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Attendance Trends */}
      <div className="card-glass overflow-hidden">
        <div className="px-6 py-5 border-b border-border/50">
          <h3 className="text-base font-extrabold text-foreground">Attendance Trends</h3>
        </div>
        <div className="h-64 p-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "10px" }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  cursor={{fill: 'rgba(255,255,255,0.05)'}}
              />
              <Bar dataKey="attendance" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue by Region */}
      <div className="card-glass overflow-hidden">
        <div className="px-6 py-5 border-b border-border/50">
          <h3 className="text-base font-extrabold text-foreground">Revenue by Region</h3>
        </div>
        <div className="h-64 p-6">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={regionData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {regionData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "10px" }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
