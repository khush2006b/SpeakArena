import { Metadata } from "next";
import { NotificationSidebar } from "@/features/teacher/components/notifications/NotificationSidebar";
import { NotificationFeed } from "@/features/teacher/components/notifications/NotificationFeed";
import { NotificationDetails } from "@/features/teacher/components/notifications/NotificationDetails";

export const metadata: Metadata = {
  title: "Notifications & Activity",
  description: "Enterprise notification center and class activity timeline.",
};

export default function NotificationsPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] h-[calc(100vh-4rem)] flex overflow-hidden border-x border-border/50 bg-secondary/10">
      {/* Left Sidebar (Categories) */}
      <div className="w-[260px] hidden md:block shrink-0">
        <NotificationSidebar />
      </div>

      {/* Main Feed */}
      <div className="flex-1 flex flex-col min-w-0 bg-background shadow-sm z-10">
        <NotificationFeed />
      </div>

      {/* Right Details Panel */}
      <div className="hidden xl:block shrink-0">
        <NotificationDetails />
      </div>
    </div>
  );
}
