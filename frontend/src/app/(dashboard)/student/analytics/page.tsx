import { Metadata } from "next";
import { AnalyticsDashboard } from "@/features/student/components/analytics/AnalyticsDashboard";

export const metadata: Metadata = {
  title: "Learning Analytics - Speak Arena",
  description: "Your personal learning dashboard and progress insights.",
};

export default function AnalyticsPage() {
  return (
    <div className="flex-1 w-full bg-background overflow-y-auto custom-scrollbar">
      <AnalyticsDashboard />
    </div>
  );
}
