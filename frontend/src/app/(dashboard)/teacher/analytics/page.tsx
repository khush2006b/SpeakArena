import { Metadata } from "next";
import { AnalyticsHeader } from "@/features/teacher/components/analytics/AnalyticsHeader";
import { InsightsPanel } from "@/features/teacher/components/analytics/InsightsPanel";
import TrendCharts from "@/features/teacher/components/analytics/TrendCharts";
import AnalyticsStats from "@/features/teacher/components/analytics/AnalyticsStats";
import AttendanceHeatmap from "@/features/teacher/components/analytics/AttendanceHeatmap";
import ReportTable from "@/features/teacher/components/analytics/ReportTable";
import ReportDrawer from "@/features/teacher/components/analytics/ReportDrawer";

export const metadata: Metadata = {
  title: "Analytics & Performance",
  description: "Enterprise analytics for student attendance and performance.",
};

export default function AnalyticsPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-8 pb-24 space-y-8 min-h-screen flex flex-col">
      <AnalyticsHeader />
      <InsightsPanel />
      
      {/* Chart Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <TrendCharts />
        </div>
        <div>
          <AnalyticsStats />
        </div>
      </div>

      <AttendanceHeatmap />

      <ReportTable />

      <ReportDrawer />
    </div>
  );
}
