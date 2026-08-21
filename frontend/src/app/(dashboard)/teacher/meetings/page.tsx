import { Metadata } from "next";
import { MeetingHeader } from "@/features/teacher/components/meetings/MeetingHeader";
import { MeetingStats } from "@/features/teacher/components/meetings/MeetingStats";
import { AgendaPanel } from "@/features/teacher/components/meetings/AgendaPanel";
import { MeetingDrawer } from "@/features/teacher/components/meetings/MeetingDrawer";
import { MeetingModal } from "@/features/teacher/components/meetings/MeetingModal";

export const metadata: Metadata = {
  title: "Meeting Management",
  description: "Manage your live classes and recurring sessions.",
};

export default function MeetingsPage() {
  return (
    <div className="w-full space-y-6">
      <MeetingHeader />
      <MeetingStats />
      
      <div className="w-full flex flex-col">
        <AgendaPanel />
      </div>

      <MeetingDrawer />
      <MeetingModal />
    </div>
  );
}
