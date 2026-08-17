"use client";

import * as React from "react";
import { Search } from "lucide-react";

interface ResourcesHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  totalResourcesCount?: number;
}

export function ResourcesHeader({
  searchQuery,
  setSearchQuery,
  totalResourcesCount = 0,
}: ResourcesHeaderProps) {
  return (
    <div className="grid-bg relative rounded-2xl px-6 py-8 mb-8 border border-border/50 bg-card/60 backdrop-blur-xl animate-fade-up overflow-hidden">
      {/* Ambient glow */}
      <div className="glow-indigo absolute -top-10 -left-10 pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-responsive-xl font-extrabold tracking-tight text-foreground">
              My Resources
            </h1>
            {totalResourcesCount > 0 && (
              <span className="badge-primary">
                {totalResourcesCount} files
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Access all your course materials, videos, and PDFs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search across all courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 h-10 bg-secondary/50 border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
