"use client";

import * as React from "react";

export function SettingsHeader() {
  return (
    <div className="h-20 shrink-0 flex items-center justify-between px-4 sm:px-8 border-b border-border/50 bg-card/80 backdrop-blur-3xl sticky top-0 z-20 shadow-md glow-purple">
      <div className="flex items-center gap-4 flex-1">
        <h2 className="font-extrabold text-xl text-foreground tracking-tight">Platform Settings</h2>
      </div>
    </div>
  );
}
