/**
 * 403 Forbidden error state.
 *
 * Rendered when an authenticated user tries to access a resource
 * they don't have permission to view (wrong role, unpaid course, etc.).
 */

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

interface ErrorForbiddenProps {
  className?: string;
  message?: string;
}

export function ErrorForbidden({
  className,
  message = "You don\u2019t have permission to view this page.",
}: ErrorForbiddenProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-5 px-4 py-24 text-center",
        className,
      )}
      role="alert"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert
          className="h-7 w-7 text-destructive"
          aria-hidden="true"
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          403 &mdash; Forbidden
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Access denied
        </h1>
        <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
      </div>
      <Link
        href={ROUTES.HOME}
        className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Go home
      </Link>
    </div>
  );
}
