import { TeacherResourcesDashboard } from "@/features/teacher/components/resources/TeacherResourcesDashboard";

export const metadata = {
  title: "Resources | Teacher — SpeakArena",
  description: "Manage your course videos and PDF resources.",
};

export default function TeacherResourcesPage() {
  return <TeacherResourcesDashboard />;
}
