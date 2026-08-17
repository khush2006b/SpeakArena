import { Metadata } from "next";
import { ResourcesDashboard } from "@/features/student/components/resources/ResourcesDashboard";

export const metadata: Metadata = {
  title: "Resources - SpeakArena",
  description: "Access course materials, code snippets, and PDFs.",
};

export default function ResourcesPage() {
  return (
    <div className="flex-1 w-full bg-background overflow-y-auto custom-scrollbar">
      <ResourcesDashboard />
    </div>
  );
}
