/**
 * Offline error state.
 *
 * Rendered when the browser detects no internet connection.
 * Listens to the online/offline events and auto-recovers.
 */

"use client";

import { useState, useEffect } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorOfflineProps {
  className?: string;
}

export function ErrorOffline({ className }: ErrorOfflineProps) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-5 px-4 py-16 text-center",
        className,
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
        <WifiOff
          className="h-6 w-6 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">You\u2019re offline</h2>
        <p className="max-w-xs text-sm text-muted-foreground">
          Check your internet connection. The page will reload automatically
          when you\u2019re back online.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Reload
      </button>
    </div>
  );
}
