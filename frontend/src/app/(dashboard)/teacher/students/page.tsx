import { Metadata } from "next";
import { StudentHeader } from "@/features/teacher/components/students/StudentHeader";
import { StudentStats } from "@/features/teacher/components/students/StudentStats";
import { StudentViewContainer } from "@/features/teacher/components/students/StudentViewContainer";
import { StudentDrawer } from "@/features/teacher/components/students/StudentDrawer";
import { AddStudentModal } from "@/features/teacher/components/students/AddStudentModal";

export const metadata: Metadata = {
  title: "Student Management",
  description: "Manage enrollments, monitor progress, and engage with your students.",
};

export default function StudentsPage() {
  return (
    <div className="mx-auto w-full py-8 pb-24 space-y-8 min-h-screen flex flex-col">
      <StudentHeader />
      <StudentStats />
      
      <StudentViewContainer />

      <StudentDrawer />
      <AddStudentModal />
    </div>
  );
}
