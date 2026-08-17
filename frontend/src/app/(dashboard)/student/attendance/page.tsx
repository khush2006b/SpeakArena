import { Metadata } from "next";
import { StudentAttendanceView } from "@/features/student/components/attendance/StudentAttendanceView";

export const metadata: Metadata = {
  title: "Attendance History",
  description: "Review your live class attendance records.",
};

export default function StudentAttendancePage() {
  return <StudentAttendanceView />;
}
