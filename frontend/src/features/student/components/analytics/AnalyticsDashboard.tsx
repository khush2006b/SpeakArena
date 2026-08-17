"use client";

import * as React from "react";
import { AnalyticsSummary } from "./AnalyticsSummary";
import { ContributionHeatmap } from "./ContributionHeatmap";
import { CourseProgressRing } from "./CourseProgressRing";
import { TopicRadarChart } from "./TopicRadarChart";
import { AchievementsGrid } from "./AchievementsGrid";
import { PersonalInsights } from "./PersonalInsights";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function AnalyticsDashboard() {
  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 pb-20 bg-background relative overflow-hidden">
      <div className="grid-bg absolute inset-0 opacity-40 pointer-events-none" />
      <div className="glow-indigo absolute pointer-events-none" style={{ width: 400, height: 400, top: -100, left: "50%", transform: "translateX(-50%)" }} />

      <div className="max-w-7xl mx-auto flex flex-col gap-6 relative z-10">
        
        {/* Header */}
        <div className="flex justify-between items-end flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-foreground font-extrabold text-responsive-xl m-0">Your Year in Code</h1>
            <p className="text-muted-foreground text-sm mt-1 m-0 page-subtitle">A detailed breakdown of your learning journey and milestones.</p>
          </div>
          <Button variant="outline" size="sm" className="flex gap-2 btn-outline press-scale rounded-lg">
            <Download className="h-4 w-4" /> Export Report
          </Button>
        </div>

        {/* 1. Top Summary Cards */}
        <AnalyticsSummary />

        {/* 2. Middle Row: Heatmap + Progress Ring */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ContributionHeatmap />
          </div>
          <div className="lg:col-span-1">
            <CourseProgressRing />
          </div>
        </div>

        {/* 3. Bottom Row: Radar Chart + AI Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <TopicRadarChart />
          </div>
          <div className="lg:col-span-2">
            <PersonalInsights />
          </div>
        </div>

        {/* 4. Achievements */}
        <AchievementsGrid />

      </div>
    </div>
  );
}
