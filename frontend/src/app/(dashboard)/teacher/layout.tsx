/**
 * Teacher portal layout — with TeacherRoute guard.
 *
 * Wraps all /teacher/* routes with a role guard. If the authenticated
 * user is not a TEACHER, they are redirected to the student dashboard.
 */

import type { Metadata } from "next";
import { TeacherLayout as Shell } from "@/features/teacher/components/layout/TeacherLayout";
import { TeacherRoute } from "@/components/guards/TeacherRoute";

export const metadata: Metadata = {
  title: {
    default: "Teacher Dashboard",
    template: "%s | Speak Arena",
  },
};

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TeacherRoute>
      <Shell>{children}</Shell>
    </TeacherRoute>
  );
}
