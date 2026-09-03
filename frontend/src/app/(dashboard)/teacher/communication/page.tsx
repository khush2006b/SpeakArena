import { Metadata } from "next";
import { TeacherCommunicationView } from "@/features/teacher/components/communication/TeacherCommunicationView";

export const metadata: Metadata = {
  title: "Communication Center | Speak Arena",
  description: "Enterprise classroom communication and moderation.",
};

export default function CommunicationPage() {
  return <TeacherCommunicationView />;
}
