"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, Users, Video, BarChart2, FileText, ChevronRight } from "lucide-react";

const QUICK_LINKS = [
  { href: "/teacher/courses", icon: BookOpen, label: "My Courses", description: "Manage your content" },
  { href: "/teacher/students", icon: Users, label: "Students", description: "View enrollments" },
  { href: "/teacher/meetings", icon: Video, label: "Meetings", description: "Schedule sessions" },
  { href: "/teacher/analytics", icon: BarChart2, label: "Analytics", description: "Track performance" },
  { href: "/teacher/resources", icon: FileText, label: "Resources", description: "Upload materials" },
];

export function RightSidebarWidgets() {
  return (
    <div className="card-glass hover-lift rounded-2xl bg-card border border-border overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/30">
        <h3 className="m-0 text-sm font-extrabold text-foreground tracking-tight">Quick Actions</h3>
      </div>
      <div className="p-2">
        {QUICK_LINKS.map(({ href, icon: Icon, label, description }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-all group no-underline"
          >
            <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0 group-hover:bg-violet-500/20 transition-colors">
              <Icon className="h-3.5 w-3.5 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="m-0 text-xs font-bold text-foreground">{label}</p>
              <p className="m-0 text-[10px] text-muted-foreground mt-0.5">{description}</p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
