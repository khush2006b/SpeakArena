/**
 * 404 Not Found inline error state.
 *
 * Used inside pages/sections when a specific resource (course, lecture,
 * student record) cannot be found. Different from the global not-found.tsx
 * which is a full-page redirect.
 */

import { FileQuestion } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorNotFoundProps {
  className?: string;
  title?: string;
  message?: string;
  action?: React.ReactNode;
}

export function ErrorNotFound({
  className,
  title = "Not found",
  message = "The resource you\u2019re looking for doesn\u2019t exist or has been removed.",
  action,
}: ErrorNotFoundProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-5 px-4 py-16 text-center",
        className,
      )}
      role="status"
    >
      <FileQuestion
        className="h-12 w-12 text-muted-foreground/40"
        aria-hidden="true"
      />
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
