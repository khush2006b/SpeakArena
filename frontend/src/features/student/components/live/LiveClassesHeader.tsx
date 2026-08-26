"use client";

import * as React from "react";
import { Filter, CalendarDays, List } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LiveClassesHeader() {
  return (
    <div className="grid-bg relative rounded-2xl px-6 py-8 mb-8 border border-border/50 bg-card/60 backdrop-blur-xl animate-fade-up overflow-hidden">
      {/* Ambient glow */}
      <div className="glow-indigo absolute -top-10 -left-10 pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-responsive-xl font-extrabold tracking-tight text-foreground">
            Live Classes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your schedule and access class recordings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="btn-ghost h-9 w-9 shrink-0"
          >
            <Filter className="h-4 w-4" />
          </Button>

          <div className="h-6 w-px bg-border mx-1" />

          <div className="flex bg-secondary/50 border border-border/50 rounded-md p-0.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 bg-background shadow-sm text-foreground press-scale"
            >
              <List className="h-4 w-4 mr-1.5 hidden sm:block" /> List
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-muted-foreground hover:text-foreground press-scale"
            >
              <CalendarDays className="h-4 w-4 mr-1.5 hidden sm:block" /> Calendar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
