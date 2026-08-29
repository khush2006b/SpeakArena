"use client";

import * as React from "react";
import { useStudentNotificationsStore } from "@/stores/student-notifications.store";
import { NotificationCategory } from "../../constants/notifications.mock";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Inbox, Bell, Video, BookOpen, FileText, CreditCard, CalendarCheck,
  Trophy, Settings, Activity, Mailbox,
} from "lucide-react";

const CATEGORIES: {
  id: NotificationCategory | "all" | "unread";
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: "all", label: "Inbox", icon: <Inbox className="h-4 w-4" /> },
  { id: "unread", label: "Unread", icon: <Mailbox className="h-4 w-4" /> },
  { id: "announcements", label: "Announcements", icon: <Bell className="h-4 w-4" /> },
  { id: "live_classes", label: "Live Classes", icon: <Video className="h-4 w-4" /> },
  { id: "courses", label: "Courses", icon: <BookOpen className="h-4 w-4" /> },
  { id: "resources", label: "Resources", icon: <FileText className="h-4 w-4" /> },
  { id: "payments", label: "Payments", icon: <CreditCard className="h-4 w-4" /> },
  { id: "attendance", label: "Attendance", icon: <CalendarCheck className="h-4 w-4" /> },
  { id: "achievements", label: "Achievements", icon: <Trophy className="h-4 w-4" /> },
];

export function NotificationSidebar() {
  const { viewMode, setViewMode, activeCategory, setActiveCategory, notifications } =
    useStudentNotificationsStore();

  const getUnreadCount = (catId: string) => {
    if (catId === "all" || catId === "unread") return notifications.filter((n) => !n.isRead).length;
    const act = catId.toLowerCase();
    return notifications.filter((n) => {
      if (n.isRead) return false;
      const cat = (n.category || "").toLowerCase();
      const typ = (n.type || "").toLowerCase();
      if (cat === act || typ === act) return true;
      if (act === "resources" && (typ === "resource_uploaded" || n.entity_type === "video" || n.entity_type === "pdf")) return true;
      if (act === "courses" && typ === "course_published") return true;
      if (act === "announcements" && typ === "announcement") return true;
      return false;
    }).length;
  };

  return (
    <div className="w-64 shrink-0 flex flex-col h-full border-r border-border/50 bg-card/30 backdrop-blur-xl hidden md:flex">
      <ScrollArea className="flex-1 py-4">

        {/* Workspace section */}
        <div className="px-3 mb-6">
          <p className="px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
            Workspace
          </p>
          {CATEGORIES.slice(0, 2).map((cat) => (
            <SidebarItem
              key={cat.id}
              icon={cat.icon}
              label={cat.label}
              count={getUnreadCount(cat.id)}
              isActive={viewMode === "inbox" && activeCategory === cat.id}
              onClick={() => {
                setViewMode("inbox");
                setActiveCategory(cat.id);
              }}
            />
          ))}
        </div>

        {/* Categories section */}
        <div className="px-3 mb-6">
          <p className="px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
            Categories
          </p>
          {CATEGORIES.slice(2).map((cat) => (
            <SidebarItem
              key={cat.id}
              icon={cat.icon}
              label={cat.label}
              count={getUnreadCount(cat.id)}
              isActive={viewMode === "inbox" && activeCategory === cat.id}
              onClick={() => {
                setViewMode("inbox");
                setActiveCategory(cat.id);
              }}
            />
          ))}
        </div>

        {/* Preferences section */}
        <div className="px-3">
          <p className="px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
            Preferences
          </p>
          <SidebarItem
            icon={<Activity className="h-4 w-4" />}
            label="Activity Timeline"
            isActive={viewMode === "timeline"}
            onClick={() => setViewMode("timeline")}
          />
          <SidebarItem
            icon={<Settings className="h-4 w-4" />}
            label="Settings"
            isActive={viewMode === "settings"}
            onClick={() => setViewMode("settings")}
          />
        </div>

      </ScrollArea>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  count,
  isActive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer text-left press-scale ${
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={isActive ? "text-primary" : ""}>{icon}</span>
        <span>{label}</span>
      </div>
      {count !== undefined && count > 0 && (
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-bold ${
            isActive
              ? "bg-primary text-primary-foreground"
              : "bg-primary/20 text-primary"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
