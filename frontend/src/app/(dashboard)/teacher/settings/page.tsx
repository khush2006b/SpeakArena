import { Metadata } from "next";
import { SettingsSidebar } from "@/features/teacher/components/settings/SettingsSidebar";
import { SettingsHeader } from "@/features/teacher/components/settings/SettingsHeader";
import { SettingsContent } from "@/features/teacher/components/settings/SettingsContent";
import { StickySidebarLayout } from "@/components/layout/StickySidebarLayout";

export const metadata: Metadata = {
  title: "Platform Settings",
  description: "Manage your account, platform defaults, and enterprise settings.",
};

export default function SettingsPage() {
  return (
    <StickySidebarLayout 
      sidebar={<SettingsSidebar />} 
      header={<SettingsHeader />}
      mobileSidebarTitle="Settings Navigation"
    >
      <SettingsContent />
    </StickySidebarLayout>
  );
}
