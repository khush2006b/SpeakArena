"use client";

import * as React from "react";
import { 
  Download,
  Printer,
  BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnalyticsStore } from "@/stores/analytics.store";

export function AnalyticsHeader() {
  const { dateRange, setDateRange, selectedCourse, setSelectedCourse } = useAnalyticsStore();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-6 sm:p-8 mb-8 hover-lift card-glass">
      <div className="grid-bg absolute inset-0 opacity-40 pointer-events-none" />
      <div 
        className="glow-purple absolute pointer-events-none" 
        style={{ width: 400, height: 400, top: -100, left: "50%", transform: "translateX(-50%)", background: "radial-gradient(circle, hsl(270 80% 60% / 0.15) 0%, transparent 70%)" }} 
      />

      <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col">
          <h1 className="text-responsive-xl font-extrabold tracking-tight text-foreground drop-shadow-sm m-0 mb-1">
            Attendance & Performance
          </h1>
          <p className="text-responsive-lg text-muted-foreground m-0">
            Deep dive into student engagement, completion rates, and historical trends.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Selector */}
          <div className="hidden md:flex items-center rounded-lg border border-border p-1 bg-card">
            {(["today", "week", "month", "year", "all"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`flex items-center justify-center rounded-md px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all press-scale ${
                  dateRange === range ? "bg-muted shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Course Filter */}
          <div className="relative group">
            <select 
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="h-10 w-48 rounded-lg bg-background border border-border pl-9 pr-4 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-[hsl(270,80%,60%)]/50 focus:border-[hsl(270,80%,60%)]/50 transition-all shadow-sm appearance-none cursor-pointer"
            >
              <option value="all">All Courses</option>
              <option value="course-1">System Design</option>
              <option value="course-2">Advanced React</option>
            </select>
            <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none group-focus-within:text-[hsl(270,80%,60%)] transition-colors" />
          </div>

          <div className="h-6 w-px bg-border hidden sm:block mx-1" />

          <Button variant="outline" className="hidden sm:flex h-10 border-border bg-card hover:bg-muted transition-all font-semibold tracking-tight btn-ghost press-scale">
            <Printer className="mr-2 h-4 w-4 text-muted-foreground" />
            Print
          </Button>

          <Button className="btn-primary press-scale h-10 font-bold tracking-tight shadow-[0_0_15px_hsla(270,80%,60%,0.3)] hover:shadow-[0_0_25px_hsla(270,80%,60%,0.5)] transition-all sm:ml-2 bg-[hsl(270,80%,60%)] border-none text-white">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>
    </div>
  );
}
