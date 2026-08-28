"use client";

import React from "react";
import Link from "next/link";
import { Bell, Menu, MessageSquare } from "lucide-react";
import { useStudentLayoutStore } from "@/stores/student-layout.store";
import { useChatStore } from "@/stores/chat.store";
import { ProfileMenu } from "./ProfileMenu";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export function StudentHeader() {
  const { toggleSidebar } = useStudentLayoutStore();
  const { hasUnread } = useChatStore();

  return (
    <header
      className="sticky top-0 z-40 w-full"
      style={{
        background: "hsl(var(--card) / 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid hsl(var(--border))",
      }}
    >
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6" style={{ height: 64 }}>

        {/* Mobile hamburger + logo */}
        <div className="flex items-center gap-3 lg:hidden flex-shrink-0">
          <button
            onClick={toggleSidebar}
            className="btn-ghost press-scale"
            style={{ width: 44, height: 44, padding: 0, justifyContent: "center", borderRadius: 10 }}
            aria-label="Open sidebar"
          >
            <Menu style={{ width: 18, height: 18 }} />
          </button>
          <Link href="/student" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, hsl(var(--primary)), hsl(244 76% 65%))", textDecoration: "none", flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>S</span>
          </Link>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          {/* Messages / Chat */}
          <Link
            href="/student/messages"
            className="btn-ghost press-scale flex items-center justify-center"
            style={{ position: "relative", width: 44, height: 44, padding: 0, borderRadius: 10 }}
            aria-label="Messages & Chat"
            title="Messages & Chat"
          >
            <MessageSquare style={{ width: 17, height: 17 }} />
            {hasUnread && (
              <span style={{
                position: "absolute", top: 9, right: 9, width: 8, height: 8,
                borderRadius: "50%", background: "#ef4444",
                border: "2px solid hsl(var(--card))",
              }} className="animate-pulse" />
            )}
          </Link>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <Link
            href="/student/notifications"
            className="btn-ghost press-scale flex items-center justify-center"
            style={{ position: "relative", width: 44, height: 44, padding: 0, borderRadius: 10 }}
            aria-label="Notifications"
          >
            <Bell style={{ width: 17, height: 17 }} />
          </Link>

          {/* Divider */}
          <div className="hidden sm:block" style={{ width: 1, height: 24, background: "hsl(var(--border))" }} />

          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
