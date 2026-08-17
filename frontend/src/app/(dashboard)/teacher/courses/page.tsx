import { Metadata } from "next";
import { CourseHeader } from "@/features/teacher/components/courses/CourseHeader";
import { CourseStatsCards } from "@/features/teacher/components/courses/CourseStatsCards";
import { CourseToolbar } from "@/features/teacher/components/courses/CourseToolbar";
import { CourseViewContainer } from "@/features/teacher/components/courses/CourseViewContainer";

export const metadata: Metadata = {
  title: "Course Management",
  description: "Manage your SpeakArena enterprise courses.",
};

export default function CoursesPage() {
  return (
    <div className="w-full">
      <CourseHeader />
      
      <div className="space-y-6">
        <CourseStatsCards />
        <CourseToolbar />
        <CourseViewContainer />
      </div>
    </div>
  );
}
