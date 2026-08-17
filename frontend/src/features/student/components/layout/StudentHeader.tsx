"use client";

import React from "react";
import Link from "next/link";
import { Bell, Menu, Search } from "lucide-react";
import { useStudentLayoutStore } from "@/stores/student-layout.store";
import { ProfileMenu } from "./ProfileMenu";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export function StudentHeader() {
  const { toggleSidebar } = useStudentLayoutStore();
  const [searchFocused, setSearchFocused] = React.useState(false);

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
      <div className="flex items-center gap-3 px-4 sm:px-6" style={{ height: 64 }}>

        {/* Mobile hamburger + logo */}
        <div className="flex items-center gap-3 lg:hidden flex-shrink-0">
          <button
            onClick={toggleSidebar}
            className="btn-ghost press-scale"
            style={{ width: 38, height: 38, padding: 0, justifyContent: "center", borderRadius: 10 }}
            aria-label="Open sidebar"
          >
            <Menu style={{ width: 18, height: 18 }} />
          </button>
          <Link href="/student" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, hsl(var(--primary)), hsl(244 76% 65%))", textDecoration: "none", flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>S</span>
          </Link>
        </div>

        {/* Search — expands on focus on mobile */}
        <div
          className="flex-1 flex items-center max-w-lg sm:max-w-md"
          style={{ position: "relative" }}
        >
          <Search
            style={{
              position: "absolute", left: 13, width: 15, height: 15,
              color: "hsl(var(--muted-foreground))", pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search courses, topics…"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="w-full"
            style={{
              height: 38, paddingLeft: 38, paddingRight: 16,
              background: "hsl(var(--background))",
              border: `1px solid ${searchFocused ? "hsl(var(--primary))" : "hsl(var(--border))"}`,
              borderRadius: 10, fontSize: 14, color: "hsl(var(--foreground))",
              outline: "none",
              boxShadow: searchFocused ? "0 0 0 3px hsl(var(--primary) / 0.12)" : "none",
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
          />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <button
            className="btn-ghost press-scale"
            style={{ position: "relative", width: 38, height: 38, padding: 0, justifyContent: "center", borderRadius: 10 }}
            aria-label="Notifications"
          >
            <Bell style={{ width: 17, height: 17 }} />
            <span style={{
              position: "absolute", top: 9, right: 9, width: 7, height: 7,
              borderRadius: "50%", background: "#ef4444",
              border: "2px solid hsl(var(--card))",
            }} />
          </button>

          {/* Divider */}
          <div className="hidden sm:block" style={{ width: 1, height: 24, background: "hsl(var(--border))" }} />

          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
