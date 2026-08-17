import { Metadata } from "next";
import { ProgressView } from "@/features/student/components/progress/ProgressView";

export const metadata: Metadata = {
  title: "Progress & Certificates",
  description: "View your learning streak and course completion certificates.",
};

export default function ProgressPage() {
  return <ProgressView />;
}
