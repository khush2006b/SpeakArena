import { Metadata } from "next";
import { StudentProfileDashboard } from "@/features/student/components/profile/StudentProfileDashboard";

export const metadata: Metadata = {
  title: "Student Profile - Speak Arena",
  description: "Your learning identity and achievements.",
};

export default function StudentProfilePage() {
  return (
    <div className="flex-1 w-full bg-background overflow-hidden flex flex-col">
      <StudentProfileDashboard />
    </div>
  );
}
