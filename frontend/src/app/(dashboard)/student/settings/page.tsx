import { Metadata } from "next";
import { SettingsLayout } from "@/features/student/components/settings/SettingsLayout";

export const metadata: Metadata = {
  title: "Settings & Preferences - SpeakArena",
  description: "Manage your account configurations and learning preferences.",
};

export default function StudentSettingsPage() {
  return (
    <div className="flex-1 w-full bg-background overflow-hidden flex flex-col">
      <SettingsLayout />
    </div>
  );
}
