"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Library, Video, BookOpen, Compass,
  Trophy, CalendarCheck, CreditCard, MessageSquare, Bookmark,
  ChevronRight, ChevronLeft, Mic2, X, ClipboardCheck,
} from "lucide-react";
import { useStudentLayoutStore } from "@/stores/student-layout.store";

const NAV_ITEMS = [
  {
    group: "Learning",
    items: [
      { name: "Dashboard", href: "/student", icon: LayoutDashboard },
      { name: "My Courses", href: "/student/courses", icon: Library },
      { name: "Explore Courses", href: "/student/explore", icon: Compass },
      { name: "Live Classes", href: "/student/live", icon: Video },
      { name: "Resources", href: "/student/resources", icon: BookOpen },
    ],
  },
  {
    group: "Performance",
    items: [
      { name: "Progress", href: "/student/progress", icon: Trophy },
      { name: "Tests", href: "/student/tests", icon: ClipboardCheck },
      { name: "Attendance", href: "/student/attendance", icon: CalendarCheck },
    ],
  },
  {
    group: "Account",
    items: [
      { name: "Messages", href: "/student/messages", icon: MessageSquare },
      { name: "Bookmarks", href: "/student/bookmarks", icon: Bookmark },
      { name: "Payments", href: "/student/payments", icon: CreditCard },
    ],
  },
];

export function StudentSidebar() {
  const pathname = usePathname();
  const { isSidebarExpanded, toggleSidebar } = useStudentLayoutStore();
  const [isHovered, setIsHovered] = React.useState(false);
  const isExpanded = isSidebarExpanded || isHovered;

  // ── Desktop sidebar ──────────────────────────────────────────────────────
  const DesktopSidebar = (
    <motion.aside
      initial={false}
      animate={{ width: isExpanded ? 248 : 68 }}
      transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
      onMouseEnter={() => !isSidebarExpanded && setIsHovered(true)}
      onMouseLeave={() => !isSidebarExpanded && setIsHovered(false)}
      className="hidden lg:flex flex-col flex-shrink-0 sticky top-0 z-50 h-screen overflow-hidden"
      style={{
        background: "hsl(var(--card))",
        borderRight: "1px solid hsl(var(--border))",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center flex-shrink-0"
        style={{ height: 64, padding: "0 18px", borderBottom: "1px solid hsl(var(--border))" }}
      >
        <Link href="/student" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg, hsl(var(--primary)), hsl(244 76% 65%))",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 20px hsl(var(--primary) / 0.3)",
          }}>
            <Mic2 style={{ width: 17, height: 17, color: "#fff" }} />
          </div>
          <AnimatePresence>
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                style={{ fontSize: 17, fontWeight: 800, color: "hsl(var(--foreground))", letterSpacing: "-0.03em", whiteSpace: "nowrap" }}
              >
                SpeakArena
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ padding: "20px 10px", display: "flex", flexDirection: "column", gap: 28 }}>
        {NAV_ITEMS.map((group) => (
          <div key={group.group} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ padding: "0 8px", marginBottom: 6, overflow: "hidden" }}
                >
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
                    letterSpacing: "0.1em", color: "hsl(var(--muted-foreground) / 0.6)",
                  }}>
                    {group.group}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {group.items.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/student" && pathname.startsWith(item.href + "/"));
              return (
                <Link key={item.name} href={item.href} prefetch style={{ textDecoration: "none" }} title={!isExpanded ? item.name : undefined}>
                  <div
                    className={`nav-item ${isActive ? "active" : ""}`}
                    style={{
                      justifyContent: isExpanded ? "flex-start" : "center",
                      padding: isExpanded ? "9px 12px" : "9px 0",
                    }}
                  >
                    {/* Active left bar */}
                    {isActive && (
                      <div style={{
                        position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                        width: 3, height: 18, borderRadius: "0 3px 3px 0",
                        background: "hsl(var(--primary))",
                      }} />
                    )}
                    <item.icon style={{
                      width: 18, height: 18, flexShrink: 0,
                      color: isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                    }} />
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          style={{
                            fontSize: 14, whiteSpace: "nowrap", overflow: "hidden",
                            fontWeight: isActive ? 700 : 500,
                            color: isActive ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                          }}
                        >
                          {item.name}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Pin toggle */}
      <div style={{ padding: "12px 10px", borderTop: "1px solid hsl(var(--border))", flexShrink: 0 }}>
        <button
          onClick={toggleSidebar}
          className="btn-ghost"
          style={{ width: "100%", height: 38, justifyContent: "center", padding: 0 }}
          title={isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isSidebarExpanded
            ? <ChevronLeft style={{ width: 16, height: 16 }} />
            : <ChevronRight style={{ width: 16, height: 16 }} />
          }
        </button>
      </div>
    </motion.aside>
  );

  // ── Mobile drawer ─────────────────────────────────────────────────────────
  const MobileDrawer = (
    <AnimatePresence>
      {isSidebarExpanded && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={toggleSidebar}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col lg:hidden"
            style={{ background: "hsl(var(--card))", borderRight: "1px solid hsl(var(--border))" }}
          >
            {/* Mobile header */}
            <div className="flex items-center justify-between flex-shrink-0" style={{ height: 64, padding: "0 18px", borderBottom: "1px solid hsl(var(--border))" }}>
              <Link href="/student" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }} onClick={toggleSidebar}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, hsl(var(--primary)), hsl(244 76% 65%))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Mic2 style={{ width: 15, height: 15, color: "#fff" }} />
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color: "hsl(var(--foreground))", letterSpacing: "-0.03em" }}>SpeakArena</span>
              </Link>
              <button
                onClick={toggleSidebar}
                className="btn-ghost"
                style={{ width: 36, height: 36, padding: 0, justifyContent: "center" }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Nav */}
            <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ padding: "20px 10px", display: "flex", flexDirection: "column", gap: 24 }}>
              {NAV_ITEMS.map((group) => (
                <div key={group.group} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ padding: "0 8px", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "hsl(var(--muted-foreground) / 0.6)" }}>
                      {group.group}
                    </span>
                  </div>
                  {group.items.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/student" && pathname.startsWith(item.href + "/"));
                    return (
                      <Link key={item.name} href={item.href} style={{ textDecoration: "none" }} onClick={toggleSidebar}>
                        <div className={`nav-item ${isActive ? "active" : ""}`}>
                          {isActive && (
                            <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 18, borderRadius: "0 3px 3px 0", background: "hsl(var(--primary))" }} />
                          )}
                          <item.icon style={{ width: 18, height: 18, flexShrink: 0, color: isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }} />
                          <span style={{ fontSize: 14, fontWeight: isActive ? 700 : 500, color: isActive ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}>
                            {item.name}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {DesktopSidebar}
      {MobileDrawer}
    </>
  );
}
