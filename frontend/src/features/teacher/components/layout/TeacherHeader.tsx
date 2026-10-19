"use client";

import React from "react";
import Link from "next/link";
import { Bell, Menu, MessageSquare } from "lucide-react";
import { useUIStore } from "@/stores/ui.store";
import { useChatStore } from "@/stores/chat.store";
import { useUnreadNotificationCount } from "@/hooks/queries/useNotificationQueries";
import { TeacherProfileMenu } from "./TeacherProfileMenu";
import { QuickActionsDropdown } from "./QuickActionsDropdown";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export function TeacherHeader() {
  const toggleNotificationDrawer = useUIStore((s) => s.toggleNotificationDrawer);
  const { hasUnread: hasUnreadChat } = useChatStore();
  const { data: unreadNotifData } = useUnreadNotificationCount();
  const unreadNotifCount =
    typeof unreadNotifData === "number"
      ? unreadNotifData
      : (unreadNotifData as any)?.unread_count ?? (unreadNotifData as any)?.count ?? 0;
  const hasUnreadNotifs = unreadNotifCount > 0;

  return (
    <header
      className="sticky top-0 z-50 w-full flex-shrink-0"
      style={{
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "0 20px",
        background: "hsl(var(--card) / 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid hsl(var(--border))",
      }}
    >
      {/* Mobile toggle */}
      <button
        onClick={() => document.getElementById('teacher-mobile-menu-trigger')?.click()}
        className="lg:hidden btn-ghost press-scale"
        style={{ width: 44, height: 44, padding: 0, justifyContent: "center", borderRadius: 10, flexShrink: 0 }}
        aria-label="Open sidebar"
      >
        <Menu style={{ width: 18, height: 18 }} />
      </button>

      {/* Right side */}
      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        <QuickActionsDropdown />

        <ThemeToggle />

        {/* Chat / Communication */}
        <Link
          href="/teacher/communication"
          className="btn-ghost press-scale flex items-center justify-center"
          style={{ position: "relative", width: 44, height: 44, padding: 0, borderRadius: 10 }}
          aria-label="Communication"
          title={hasUnreadChat ? "New messages" : "Communication"}
        >
          <MessageSquare style={{ width: 16, height: 16 }} />
          {hasUnreadChat && (
            <span style={{
              position: "absolute", top: 9, right: 9,
              display: "block", width: 7, height: 7, borderRadius: "50%",
              background: "#ef4444",
              border: "2px solid hsl(var(--card))",
            }} className="animate-pulse" />
          )}
        </Link>

        {/* Notifications */}
        <button
          onClick={toggleNotificationDrawer}
          className="btn-ghost press-scale"
          style={{ position: "relative", width: 44, height: 44, padding: 0, justifyContent: "center", borderRadius: 10 }}
          aria-label="Notifications"
          title={hasUnreadNotifs ? `${unreadNotifCount} unread notification(s)` : "Notifications"}
        >
          <Bell style={{ width: 16, height: 16 }} />
          {hasUnreadNotifs && (
            <span style={{
              position: "absolute", top: 9, right: 9,
              display: "block", width: 7, height: 7, borderRadius: "50%",
              background: "hsl(270 80% 60%)",
              border: "2px solid hsl(var(--card))",
            }} className="animate-pulse" />
          )}
        </button>

        <div style={{ width: 1, height: 24, background: "hsl(var(--border))" }} />
        <TeacherProfileMenu />
      </div>
    </header>
  );
}
