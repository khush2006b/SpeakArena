import { Metadata } from "next";
import { StudentMessagesView } from "@/features/student/components/messages/StudentMessagesView";

export const metadata: Metadata = {
  title: "Messages",
  description: "Direct messaging with course instructors and batch peers.",
};

export default function StudentMessagesPage() {
  return <StudentMessagesView />;
}
