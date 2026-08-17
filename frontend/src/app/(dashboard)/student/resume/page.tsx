import { Metadata } from "next";
import { ResumeView } from "@/features/student/components/resume/ResumeView";

export const metadata: Metadata = {
  title: "Continue Learning",
  description: "Resume your active course lessons.",
};

export default function ResumePage() {
  return <ResumeView />;
}
