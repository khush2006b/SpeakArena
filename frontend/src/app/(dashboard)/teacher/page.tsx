import { Metadata } from "next";

import { DashboardHeader } from "@/features/teacher/components/dashboard/DashboardHeader";
import { StatCards } from "@/features/teacher/components/dashboard/StatCards";
import { RecentPaymentsTable } from "@/features/teacher/components/dashboard/RecentPaymentsTable";
import { TodaysSchedule } from "@/features/teacher/components/dashboard/TodaysSchedule";
import { ActivityFeed } from "@/features/teacher/components/dashboard/ActivityFeed";
import { RightSidebarWidgets } from "@/features/teacher/components/dashboard/RightSidebarWidgets";

import { RevenueChart } from "@/features/teacher/components/dashboard/RevenueChart";

export const metadata: Metadata = {
  title: "Dashboard Overview",
  description: "Your teacher command center.",
};

export default function TeacherDashboardPage() {
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
      <DashboardHeader />
      <StatCards />
      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content Area (Col Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          <RevenueChart />
          <RecentPaymentsTable />
        </div>
        
        {/* Right Sidebar Area (Col Span 1) */}
        <div className="space-y-6">
          <TodaysSchedule />
          <ActivityFeed />
          <RightSidebarWidgets />
        </div>
      </div>
    </div>
  );
}
