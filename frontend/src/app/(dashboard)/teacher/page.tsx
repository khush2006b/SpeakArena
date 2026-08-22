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
    <div className="w-full flex flex-col gap-6">
      <DashboardHeader />
      <StatCards />

      {/* Row 2: Revenue Chart (wide) + Today's Schedule (narrow) */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueChart />
        </div>
        <div>
          <TodaysSchedule />
        </div>
      </div>

      {/* Row 3: Payments Table (wide) + Activity + Quick Links (narrow) */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentPaymentsTable />
        </div>
        <div className="flex flex-col gap-6">
          <ActivityFeed />
          <RightSidebarWidgets />
        </div>
      </div>
    </div>
  );
}
