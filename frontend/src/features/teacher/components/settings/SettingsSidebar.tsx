"use client";

import * as React from "react";
import {
  Settings,
  User,
  ShieldCheck,
  Bell,
  GraduationCap,
  BookOpen,
  Video,
  UploadCloud,
  CreditCard,
  Blocks,
  Palette,
  Accessibility,
  Sliders,
  AlertTriangle
} from "lucide-react";
import { useSettingsStore, SettingsCategory } from "@/stores/settings.store";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    title: "Account",
    items: [
      { id: "general", label: "General", icon: Settings },
      { id: "profile", label: "Profile Identity", icon: User },
      { id: "security", label: "Security & Sessions", icon: ShieldCheck },
      { id: "notifications", label: "Notifications", icon: Bell },
    ]
  },
  {
    title: "Platform & Defaults",
    items: [
      { id: "teaching", label: "Teaching Preferences", icon: GraduationCap },
      { id: "courses", label: "Course Defaults", icon: BookOpen },
      { id: "meetings", label: "Live Meetings", icon: Video },
      { id: "media", label: "Media & Uploads", icon: UploadCloud },
      { id: "payments", label: "Payments & Invoicing", icon: CreditCard },
      { id: "integrations", label: "Integrations", icon: Blocks },
    ]
  },
  {
    title: "System",
    items: [
      { id: "appearance", label: "Appearance", icon: Palette },
      { id: "accessibility", label: "Accessibility", icon: Accessibility },
      { id: "advanced", label: "Advanced Options", icon: Sliders },
    ]
  }
];

export function SettingsSidebar() {
  const { activeCategory, setActiveCategory } = useSettingsStore();

  return (
    <>
      <div className="p-4 sm:p-6 space-y-8 h-[calc(100vh-5rem)] overflow-y-auto custom-scrollbar sticky top-20 border-r border-border/50 bg-card/60 backdrop-blur-3xl">
        {NAV_GROUPS.map((group, i) => (
          <div key={i} className="space-y-3">
            <h4 className="px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <div className="h-px flex-1 bg-border/40"></div>
              {group.title}
              <div className="h-px flex-1 bg-border/40"></div>
            </h4>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeCategory === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveCategory(item.id as SettingsCategory)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] transition-all duration-300 group press-scale",
                      isActive
                        ? "bg-violet-500/15 text-violet-400 font-bold border border-violet-500/30"
                        : "text-muted-foreground hover:bg-card/60 hover:text-foreground font-semibold border border-transparent"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 transition-transform duration-300", isActive ? "text-violet-400 scale-110" : "text-muted-foreground group-hover:text-foreground")} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="space-y-2 pt-6 mt-6 relative before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-border/50 before:to-transparent">
          <button
            onClick={() => setActiveCategory("danger")}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] transition-all duration-300 group press-scale",
              activeCategory === "danger"
                ? "bg-destructive/10 text-destructive font-bold border border-destructive/30"
                : "text-destructive/80 hover:bg-destructive/5 hover:text-destructive font-semibold border border-transparent"
            )}
          >
            <AlertTriangle className={cn("h-4 w-4 transition-transform duration-300", activeCategory === "danger" ? "scale-110" : "")} />
            <span>Danger Zone</span>
          </button>
        </div>
      </div>
    </>
  );
}
