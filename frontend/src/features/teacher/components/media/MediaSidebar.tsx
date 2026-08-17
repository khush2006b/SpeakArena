"use client";

import * as React from "react";
import Link from "next/link";
import {
  FolderOpen,
  Video,
  FileText,
  Image as ImageIcon,
  Clock,
  Star,
  Archive,
  Trash2,
  Tags,
  Library
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { title: "All Media", icon: FolderOpen, href: "/teacher/media", exact: true },
  { title: "Videos", icon: Video, href: "/teacher/media?type=video" },
  { title: "PDFs", icon: FileText, href: "/teacher/media?type=pdf" },
  { title: "Images", icon: ImageIcon, href: "/teacher/media?type=image" },
];

const SECONDARY_ITEMS = [
  { title: "Recent", icon: Clock, href: "/teacher/media?filter=recent" },
  { title: "Favorites", icon: Star, href: "/teacher/media?filter=favorites" },
  { title: "Archived", icon: Archive, href: "/teacher/media?filter=archived" },
  { title: "Trash", icon: Trash2, href: "/teacher/media?filter=trash" },
];

export function MediaSidebar() {
  return (
    <aside className="w-64 shrink-0 border-r border-border/50 bg-card/80 backdrop-blur-xl hidden md:flex flex-col h-[calc(100vh-4rem)] sticky top-16 z-10 shadow-lg">
      <div className="p-6 border-b border-border/50">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Library className="h-4 w-4 text-primary" />
          Media Library
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar py-6">
        <nav className="space-y-1 px-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 group",
                item.exact
                  ? "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110", item.exact ? "text-violet-400" : "")} />
              {item.title}
            </Link>
          ))}
        </nav>

        <div className="my-6 h-px bg-border/50 mx-6" />

        <nav className="space-y-1 px-4">
          {SECONDARY_ITEMS.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-300 group"
            >
              <item.icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
              {item.title}
            </Link>
          ))}
        </nav>

        <div className="my-6 h-px bg-border/50 mx-6" />

        <div className="px-7 py-2">
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
            <Tags className="h-3.5 w-3.5" />
            Tags &amp; Collections
          </h3>
            <p className="text-xs font-medium text-muted-foreground/60 p-3 rounded-lg border border-dashed border-border/50 bg-secondary/20 text-center">
              No tags created yet.
            </p>
        </div>
      </div>
    </aside>
  );
}
