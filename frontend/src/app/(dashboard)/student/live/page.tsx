import { Metadata } from "next";
import { LiveClassesDashboard } from "@/features/student/components/live/LiveClassesDashboard";

export const metadata: Metadata = {
  title: "Live Classes - Speak Arena",
  description: "Manage your live class schedule and recordings.",
};

export default function LiveClassesPage() {
  return (
    <div className="flex-1 w-full bg-background overflow-y-auto custom-scrollbar">
      <LiveClassesDashboard />
    </div>
  );
}
