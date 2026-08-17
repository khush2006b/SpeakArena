"use client";

/**
 * 500 Server Error inline state.
 *
 * Rendered when an API request fails with a 5xx response.
 * Provides a retry action to re-fetch data.
 */

import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorServerProps {
  className?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorServer({
  className,
  message = "Something went wrong on our end. Please try again.",
  onRetry,
}: ErrorServerProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-5 px-4 py-16 text-center",
        className,
      )}
      role="alert"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle
          className="h-6 w-6 text-destructive"
          aria-hidden="true"
        />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">
          Server error
        </h2>
        <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}
