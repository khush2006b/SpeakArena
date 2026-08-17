import { Metadata } from "next";
import { MeetingHeader } from "@/features/teacher/components/meetings/MeetingHeader";
import { MeetingStats } from "@/features/teacher/components/meetings/MeetingStats";
import { CalendarWidget } from "@/features/teacher/components/meetings/CalendarWidget";
import { AgendaPanel } from "@/features/teacher/components/meetings/AgendaPanel";
import { MeetingDrawer } from "@/features/teacher/components/meetings/MeetingDrawer";
import { MeetingModal } from "@/features/teacher/components/meetings/MeetingModal";

export const metadata: Metadata = {
  title: "Meeting Management",
  description: "Manage your live classes and recurring sessions.",
};

export default function MeetingsPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-8 pb-24 space-y-8 min-h-screen flex flex-col">
      <MeetingHeader />
      <MeetingStats />
      
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-[600px] pb-10">
        {/* Calendar Split */}
        <div className="flex-1 rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden flex flex-col min-w-0">
          <CalendarWidget />
        </div>

        {/* Agenda Split */}
        <div className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col gap-4 overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
          <AgendaPanel />
        </div>
      </div>

      <MeetingDrawer />
      <MeetingModal />
    </div>
  );
}
