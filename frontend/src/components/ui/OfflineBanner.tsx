"use client";

import React from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const isOnline = useNetworkStatus();

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-in-out flex items-center gap-3 px-4 py-3 rounded-full shadow-lg bg-destructive text-destructive-foreground backdrop-blur-md",
        isOnline ? "translate-y-24 opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
      )}
      role="alert"
    >
      <WifiOff className="w-5 h-5" />
      <div className="flex flex-col">
        <span className="text-sm font-semibold">You are offline</span>
        <span className="text-xs opacity-90">Please check your internet connection.</span>
      </div>
    </div>
  );
}
