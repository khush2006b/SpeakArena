import { Metadata } from "next";
import { AttendanceView } from "@/features/teacher/components/attendance/AttendanceView";

export const metadata: Metadata = {
  title: "Attendance Records",
  description: "Track student attendance and meeting participation.",
};

export default function TeacherAttendancePage() {
  return <AttendanceView />;
}
