"use client";

import * as React from "react";
import { useStudentSettingsStore } from "@/stores/student-settings.store";
import { SettingsNavigation } from "./SettingsNavigation";
import { LearningPreferences } from "./LearningPreferences";
import { VideoPreferences } from "./VideoPreferences";
import { AccessibilitySettings } from "./AccessibilitySettings";
import { SecuritySettings } from "./SecuritySettings";
import { ConnectedDevices } from "./ConnectedDevices";
import { DangerZone } from "./DangerZone";

export function SettingsLayout() {
  const { activeTab } = useStudentSettingsStore();

  const renderContent = () => {
    switch (activeTab) {
      case "learning": return <LearningPreferences />;
      case "video": return <VideoPreferences />;
      case "accessibility": return <AccessibilitySettings />;
      case "security": return <SecuritySettings />;
      case "devices": return <ConnectedDevices />;
      case "danger": return <DangerZone />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-64 p-8 text-center bg-card/30 border border-dashed border-border/60 rounded-3xl group transition-all hover:bg-card/50">
            <div className="h-16 w-16 mb-4 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <span className="text-2xl opacity-50">🚧</span>
            </div>
            <h3 className="text-lg font-bold text-foreground">Coming Soon</h3>
            <p className="text-sm font-medium text-muted-foreground mt-2 max-w-sm">This section is under development. Check back soon!</p>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 flex flex-col h-full animate-fade-up">

      {/* Header with grid-bg texture */}
      <div className="relative grid-bg rounded-2xl px-6 py-5 mb-8 border border-border/50 bg-card/80 overflow-hidden shrink-0">
        {/* Indigo ambient glow */}
        <div className="glow-indigo w-80 h-80 -top-20 -right-20 opacity-40" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Manage your account configurations and learning preferences.</p>
          </div>
        </div>
      </div>

      {/* 2-Column Workspace */}
      <div className="flex-1 flex flex-row gap-8 min-h-0">

        {/* Left Nav — hidden on mobile */}
        <div className="hidden md:block w-64 shrink-0 border-r border-border/40 pr-4">
          <SettingsNavigation />
        </div>

        {/* Right Content Panel */}
        <div className="flex-1 min-w-0 overflow-y-auto pb-20 custom-scrollbar">
          <div className="max-w-3xl">
            {renderContent()}
          </div>
        </div>

      </div>

    </div>
  );
}
