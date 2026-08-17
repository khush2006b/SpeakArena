"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Library, Video, BarChart2, User } from "lucide-react";

const NAV_TABS = [
  { name: "Home",     href: "/student",           icon: LayoutDashboard },
  { name: "Courses",  href: "/student/courses",   icon: Library },
  { name: "Live",     href: "/student/live",      icon: Video },
  { name: "Progress", href: "/student/analytics", icon: BarChart2 },
  { name: "Profile",  href: "/student/profile",   icon: User },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      aria-label="Mobile navigation"
    >
      <div
        className="backdrop-blur-xl flex items-stretch"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          background: "hsl(var(--card) / 0.95)",
          borderTop: "1px solid hsl(var(--border))",
        }}
      >
        {NAV_TABS.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href !== "/student" && pathname.startsWith(tab.href));
          const Icon = tab.icon;

          return (
            <Link
              key={tab.name}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-1 min-h-[56px] relative transition-colors active:scale-95 touch-manipulation select-none"
              style={{ color: isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
              aria-label={tab.name}
              aria-current={isActive ? "page" : undefined}
            >
              {/* Active indicator pill */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                    style={{ background: "hsl(var(--primary))" }}
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    exit={{ opacity: 0, scaleX: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </AnimatePresence>

              <Icon
                className={`h-5 w-5 transition-transform ${isActive ? "scale-110" : "scale-100"}`}
                aria-hidden="true"
              />
              <span className="text-[10px] font-medium tracking-wide">
                {tab.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
