"use client";

import * as React from "react";
import { Settings2 } from "lucide-react";
import { useSettingsStore } from "@/stores/settings.store";
import { GeneralSettings } from "@/features/teacher/components/settings/GeneralSettings";
import { AppearanceSettings } from "@/features/teacher/components/settings/AppearanceSettings";
import { NotificationSettings } from "@/features/teacher/components/settings/NotificationSettings";
import { SecuritySettings } from "@/features/teacher/components/settings/SecuritySettings";
import { IntegrationSettings } from "@/features/teacher/components/settings/IntegrationSettings";
import { DangerZone } from "@/features/teacher/components/settings/DangerZone";

export function SettingsContent() {
  const { activeCategory } = useSettingsStore();

  switch (activeCategory) {
    case "general":
      return <GeneralSettings />;
    case "appearance":
      return <AppearanceSettings />;
    case "notifications":
      return <NotificationSettings />;
    case "security":
      return <SecuritySettings />;
    case "integrations":
      return <IntegrationSettings />;
    case "danger":
      return <DangerZone />;
    default:
      return (
        <div className="card-glass flex flex-col items-center justify-center h-[600px] text-muted-foreground p-8 animate-fade-up">
          <div className="h-20 w-20 rounded-2xl bg-card/60 flex items-center justify-center mb-6 border border-border/50">
            <Settings2 className="h-10 w-10 text-muted-foreground opacity-50" />
          </div>
          <h3 className="text-xl font-extrabold text-foreground mb-2 tracking-tight">Under Construction</h3>
          <p className="text-[15px] font-medium opacity-80 text-center max-w-md">
            The <span className="text-violet-400 font-bold">{activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)}</span> settings module is currently being built. Check back soon for updates.
          </p>
        </div>
      );
  }
}
