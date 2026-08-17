"use client";

import * as React from "react";
import { useStudentSettingsStore, SettingsCategory } from "@/stores/student-settings.store";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Settings, BookOpen, Video, FileText, Bell, Palette,
  Accessibility, ShieldCheck, Smartphone, AlertTriangle, Monitor
} from "lucide-react";

const NAVIGATION_GROUPS = [
  {
    title: "Account",
    items: [
      { id: "general", label: "General", icon: Settings },
      { id: "appearance", label: "Appearance", icon: Palette },
      { id: "accessibility", label: "Accessibility", icon: Accessibility },
    ]
  },
  {
    title: "Learning",
    items: [
      { id: "learning", label: "Learning Preferences", icon: BookOpen },
      { id: "video", label: "Video Playback", icon: Video },
      { id: "reading", label: "Reading & Notes", icon: FileText },
    ]
  },
  {
    title: "Communication",
    items: [
      { id: "notifications", label: "Notifications", icon: Bell },
    ]
  },
  {
    title: "Security & Data",
    items: [
      { id: "security", label: "Password & Security", icon: ShieldCheck },
      { id: "devices", label: "Connected Devices", icon: Smartphone },
      { id: "privacy", label: "Privacy & Data", icon: Monitor },
    ]
  },
  {
    title: "",
    items: [
      { id: "danger", label: "Danger Zone", icon: AlertTriangle, danger: true },
    ]
  }
];

export function SettingsNavigation() {
  const { activeTab, setActiveTab } = useStudentSettingsStore();

  return (
    <ScrollArea className="h-full pr-4 pb-12">
      <div className="flex flex-col gap-8">
        {NAVIGATION_GROUPS.map((group, idx) => (
          <div key={idx} className="flex flex-col gap-1">
            {group.title && (
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 px-3">
                {group.title}
              </h4>
            )}

            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const isDanger = 'danger' in item ? (item as any).danger : false;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as SettingsCategory)}
                    className={[
                      "nav-item w-full text-left press-scale",
                      isActive && !isDanger ? "active" : "",
                      isActive && isDanger
                        ? "bg-destructive/15 border-destructive/30 text-destructive"
                        : "",
                      !isActive && isDanger
                        ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                        : ""
                    ].filter(Boolean).join(" ")}
                  >
                    <Icon
                      size={16}
                      className={[
                        "shrink-0 transition-colors",
                        isActive && isDanger ? "text-destructive" : "",
                        !isActive && isDanger ? "text-destructive/70" : "",
                      ].filter(Boolean).join(" ")}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
