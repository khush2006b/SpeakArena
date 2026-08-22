"use client";

import React from "react";
import { Bell, Menu, Search } from "lucide-react";
import { useUIStore } from "@/stores/ui.store";
import { TeacherProfileMenu } from "./TeacherProfileMenu";
import { QuickActionsDropdown } from "./QuickActionsDropdown";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export function TeacherHeader() {
  const toggleSearch = useUIStore((s) => s.toggleSearch);
  const toggleNotificationDrawer = useUIStore((s) => s.toggleNotificationDrawer);
  const [searchFocused, setSearchFocused] = React.useState(false);
  const unreadNotifications = 3;

  return (
    <header
      className="sticky top-0 z-50 w-full flex-shrink-0"
      style={{
        height: 64,
        display: "flex",
        alignItems: "center",
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

      {/* Search bar — inline for desktop, icon-only on small mobile */}
      <div className="relative flex-1" style={{ maxWidth: 440 }}>
        <Search
          style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "hsl(var(--muted-foreground))", pointerEvents: "none" }}
        />
        <input
          type="text"
          placeholder="Search courses, students…"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          onClick={toggleSearch}
          readOnly
          className="w-full cursor-text"
          style={{
            height: 38, paddingLeft: 38, paddingRight: 56,
            background: "hsl(var(--background))",
            border: `1px solid ${searchFocused ? "hsl(270 80% 60%)" : "hsl(var(--border))"}`,
            borderRadius: 10, fontSize: 13, color: "hsl(var(--foreground))",
            outline: "none",
            boxShadow: searchFocused ? "0 0 0 3px hsl(270 80% 60% / 0.12)" : "none",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        />
        <kbd style={{
          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
          fontSize: 10, color: "hsl(var(--muted-foreground))", background: "hsl(var(--background))",
          border: "1px solid hsl(var(--border))", borderRadius: 4, padding: "2px 6px", fontFamily: "monospace",
        }}>⌘K</kbd>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        <QuickActionsDropdown />

        <ThemeToggle />

        {/* Notifications */}
        <button
          onClick={toggleNotificationDrawer}
          className="btn-ghost press-scale"
          style={{ position: "relative", width: 44, height: 44, padding: 0, justifyContent: "center", borderRadius: 10 }}
          aria-label="Notifications"
        >
          <Bell style={{ width: 16, height: 16 }} />
          {unreadNotifications > 0 && (
            <span style={{
              position: "absolute", top: 9, right: 9,
              display: "block", width: 7, height: 7, borderRadius: "50%",
              background: "hsl(270 80% 60%)",
              border: "2px solid hsl(var(--card))",
            }} />
          )}
        </button>

        <div style={{ width: 1, height: 24, background: "hsl(var(--border))" }} />
        <TeacherProfileMenu />
      </div>
    </header>
  );
}
