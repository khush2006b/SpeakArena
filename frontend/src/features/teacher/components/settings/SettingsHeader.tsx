"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { useSettingsStore } from "@/stores/settings.store";
import { Input } from "@/components/ui/input";

export function SettingsHeader() {
  const { searchQuery, setSearchQuery } = useSettingsStore();

  return (
    <div className="h-20 shrink-0 flex items-center justify-between px-4 sm:px-8 border-b border-border/50 bg-card/80 backdrop-blur-3xl sticky top-0 z-20 shadow-md glow-purple">
      <div className="flex items-center gap-4 flex-1">
        <h2 className="font-extrabold text-xl text-foreground tracking-tight">Platform Settings</h2>
      </div>

      <div className="flex items-center gap-4 max-w-sm w-full">
        <div className="relative w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-violet-400 transition-colors" />
          <Input
            placeholder="Search settings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-11 rounded-xl bg-card/50 border-border/50 focus-visible:ring-1 focus-visible:ring-violet-500/50 focus-visible:border-violet-500/50 hover:bg-card/80 transition-all text-foreground font-semibold"
          />
        </div>
      </div>
    </div>
  );
}
