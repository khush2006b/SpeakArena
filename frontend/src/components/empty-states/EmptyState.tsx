"use client";

/**
 * Generic empty state component.
 *
 * Renders a centered illustration (icon), heading, description,
 * and an optional call-to-action. Used across every list, table,
 * and grid in the app when there is no data to display.
 *
 * @example
 * <EmptyState
 *   icon={BookOpen}
 *   title="No courses yet"
 *   description="Create your first course to get started."
 *   action={<Button onClick={handleCreate}>Create course</Button>}
 * />
 */

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-4 py-16 text-center",
        className,
      )}
      role="status"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Icon
          className="h-8 w-8 text-muted-foreground/50"
          aria-hidden="true"
          strokeWidth={1.5}
        />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
