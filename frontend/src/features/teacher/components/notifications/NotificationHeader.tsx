"use client";

import * as React from "react";
import { Search, Filter, CheckCircle2, Settings } from "lucide-react";
import { useNotificationsStore } from "@/stores/notifications.store";
import { Button } from "@/components/ui/button";

export function NotificationHeader() {
  const { activeCategory, searchQuery, setSearchQuery } = useNotificationsStore();

  const title = activeCategory === "inbox" ? "Inbox" :
                activeCategory === "unread" ? "Unread Notifications" :
                activeCategory === "activity" ? "Activity Timeline" :
                activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1);

  return (
    <div className="h-20 shrink-0 flex items-center justify-between px-4 sm:px-8 border-b border-border/50 bg-card/80 backdrop-blur-xl z-20 shadow-md glow-purple">
      <div className="flex items-center gap-6 flex-1">
        <h2 className="font-extrabold text-xl text-foreground tracking-tight">{title}</h2>
        <div className="h-6 w-px bg-border/50 hidden sm:block" />
        <div className="relative max-w-md w-full hidden sm:block group">
          <div className="absolute inset-0 bg-violet-500/10 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <div className="relative flex items-center">
            <Search className="absolute left-4 h-4 w-4 text-muted-foreground group-focus-within:text-violet-400 transition-colors" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 rounded-xl border border-border/50 bg-card/50 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all hover:bg-card/80 font-semibold"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="btn-ghost h-10 w-10 rounded-xl press-scale">
          <Filter className="h-4 w-4" />
        </Button>
        <div className="h-5 w-px bg-border/50" />
        <Button variant="outline" size="sm" className="h-10 px-4 rounded-xl border-border/50 bg-card/40 hover:bg-card/80 hidden md:flex text-muted-foreground hover:text-foreground font-bold tracking-wide transition-all press-scale">
          <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" />
          Mark all as read
        </Button>
        <Button variant="ghost" size="icon" className="btn-ghost h-10 w-10 rounded-xl press-scale">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
