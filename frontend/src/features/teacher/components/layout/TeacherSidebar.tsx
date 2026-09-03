"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Presentation, FileText, Users, CalendarDays,
  CreditCard, BarChart3, MessageSquare, Settings, ChevronLeft,
  Mic2, X, ClipboardCheck, User,
} from "lucide-react";
import { useUIStore } from "@/stores/ui.store";

const NAVIGATION = [
  {
    group: "Overview",
    items: [
      { name: "Dashboard", href: "/teacher", icon: LayoutDashboard },
      { name: "Analytics", href: "/teacher/analytics", icon: BarChart3 },
    ],
  },
  {
    group: "Management",
    items: [
      { name: "Courses", href: "/teacher/courses", icon: Presentation },
      { name: "Resources", href: "/teacher/resources", icon: FileText },
      { name: "Students", href: "/teacher/students", icon: Users },
      { name: "Tests & Grades", href: "/teacher/tests", icon: ClipboardCheck },
      { name: "Meetings", href: "/teacher/meetings", icon: CalendarDays },
    ],
  },
  {
    group: "Communications",
    items: [
      { name: "Chat", href: "/teacher/chat", icon: MessageSquare },
    ],
  },
  {
    group: "Business",
    items: [
      { name: "Profile", href: "/teacher/profile", icon: User },
      { name: "Payments", href: "/teacher/payments", icon: CreditCard },
      { name: "Settings", href: "/teacher/settings", icon: Settings },
    ],
  },
];

// Teacher brand color: purple / violet
const TEACHER_PRIMARY = "hsl(270 80% 60%)";
const TEACHER_PRIMARY_BG = "hsl(270 80% 60% / 0.12)";
const TEACHER_PRIMARY_BORDER = "hsl(270 80% 60% / 0.3)";

function NavItems({ isCollapsed, onLinkClick }: { isCollapsed: boolean; onLinkClick?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ padding: "20px 10px", display: "flex", flexDirection: "column", gap: 28 }}>
      {NAVIGATION.map((group) => (
        <div key={group.group} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{ padding: "0 8px", marginBottom: 6, overflow: "hidden" }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: "hsl(var(--muted-foreground) / 0.6)", textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>
                  {group.group}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {group.items.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/teacher" && pathname.startsWith(item.href + "/"));
            return (
              <Link key={item.name} href={item.href} prefetch style={{ textDecoration: "none" }} {...(isCollapsed && item.name ? { title: item.name } : {})} {...(onLinkClick ? { onClick: onLinkClick } : {})}>
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 10, borderRadius: 10,
                    padding: isCollapsed ? "9px 0" : "9px 12px",
                    justifyContent: isCollapsed ? "center" : "flex-start",
                    background: isActive ? TEACHER_PRIMARY_BG : "transparent",
                    border: isActive ? `1px solid ${TEACHER_PRIMARY_BORDER}` : "1px solid transparent",
                    transition: "background 0.15s, border-color 0.15s",
                    position: "relative", cursor: "pointer",
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "hsl(var(--accent))"; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {isActive && !isCollapsed && (
                    <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 18, borderRadius: "0 3px 3px 0", background: TEACHER_PRIMARY }} />
                  )}
                  <item.icon style={{ width: 18, height: 18, flexShrink: 0, color: isActive ? TEACHER_PRIMARY : "hsl(var(--muted-foreground))" }} />
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        style={{ fontSize: 14, fontWeight: isActive ? 700 : 500, color: isActive ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))", whiteSpace: "nowrap", overflow: "hidden" }}
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
  );
}

export function TeacherSidebar() {
  const isCollapsed = useUIStore((s) => s.isSidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // ── Desktop Sidebar ──────────────────────────────────────────────────────
  const DesktopSidebar = (
    <motion.div
      initial={false}
      animate={{ width: isCollapsed ? 68 : 248 }}
      transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
      className="hidden lg:flex flex-col flex-shrink-0 sticky top-0 z-20 h-screen overflow-hidden"
      style={{ background: "hsl(var(--card))", borderRight: "1px solid hsl(var(--border))" }}
    >
      {/* Logo */}
      <div className="flex items-center flex-shrink-0" style={{ height: 64, padding: "0 17px", borderBottom: "1px solid hsl(var(--border))" }}>
        <Link href="/teacher" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #7c3aed, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 20px rgba(124,58,237,0.3)" }}>
            <Mic2 style={{ width: 17, height: 17, color: "hsl(var(--foreground))" }} />
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                style={{ fontSize: 17, fontWeight: 800, color: "hsl(var(--foreground))", letterSpacing: "-0.03em", whiteSpace: "nowrap" }}
              >
                Speak Arena
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Collapse toggle floating button */}
      <button
        onClick={toggleSidebar}
        style={{
          position: "absolute", right: -12, top: 76, zIndex: 30,
          width: 24, height: 24, borderRadius: "50%",
          background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "hsl(var(--muted-foreground))",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)", transition: "background 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--accent))")}
        onMouseLeave={e => (e.currentTarget.style.background = "hsl(var(--card))")}
      >
        <ChevronLeft style={{ width: 13, height: 13, transform: isCollapsed ? "rotate(180deg)" : "none", transition: "transform 0.28s" }} />
      </button>

      <NavItems isCollapsed={isCollapsed} />

      {/* Workspace badge */}
      <div style={{ padding: "14px 10px", borderTop: "1px solid hsl(var(--border))", flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, borderRadius: 10,
          padding: isCollapsed ? "10px 0" : "10px 12px",
          justifyContent: isCollapsed ? "center" : "flex-start",
          background: "hsl(270 80% 60% / 0.08)", border: "1px solid hsl(270 80% 60% / 0.2)",
        }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "hsl(270 80% 60% / 0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: TEACHER_PRIMARY }}>T</span>
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                style={{ overflow: "hidden" }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "hsl(var(--foreground))", whiteSpace: "nowrap" }}>Teacher Workspace</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pro Plan</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );

  // ── Mobile Drawer ────────────────────────────────────────────────────────
  const MobileDrawer = (
    <AnimatePresence>
      {mobileOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <motion.div
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col lg:hidden"
            style={{ background: "hsl(var(--card))", borderRight: "1px solid hsl(var(--border))" }}
          >
            <div className="flex items-center justify-between flex-shrink-0" style={{ height: 64, padding: "0 18px", borderBottom: "1px solid hsl(var(--border))" }}>
              <Link href="/teacher" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }} onClick={() => setMobileOpen(false)}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #7c3aed, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Mic2 style={{ width: 15, height: 15, color: "hsl(var(--foreground))" }} />
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color: "hsl(var(--foreground))", letterSpacing: "-0.03em" }}>Speak Arena</span>
              </Link>
              <button className="btn-ghost" style={{ width: 36, height: 36, padding: 0, justifyContent: "center" }} onClick={() => setMobileOpen(false)}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <NavItems isCollapsed={false} onLinkClick={() => setMobileOpen(false)} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {DesktopSidebar}
      {MobileDrawer}
      {/* Expose mobile toggle via data attr so TeacherHeader can trigger it */}
      <div id="teacher-mobile-menu-trigger" data-open={mobileOpen ? "true" : "false"} style={{ display: "none" }} onClick={() => setMobileOpen(v => !v)} />
    </>
  );
}
