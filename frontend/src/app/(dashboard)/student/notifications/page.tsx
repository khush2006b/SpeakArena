import { Metadata } from "next";
import { NotificationsDashboard } from "@/features/student/components/notifications/NotificationsDashboard";

export const metadata: Metadata = {
  title: "Notifications & Activity - SpeakArena",
  description: "Your personal learning inbox.",
};

export default function NotificationsPage() {
  return (
    <div className="flex-1 w-full h-full bg-background overflow-hidden">
      <NotificationsDashboard />
    </div>
  );
}
