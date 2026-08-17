/**
 * Global loading UI.
 *
 * Rendered by Next.js when a page segment is loading (Suspense boundary).
 * Shows a subtle top progress bar — Linear-style perceived performance.
 */

import { Loader2 } from "lucide-react";

export default function GlobalLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2
          className="h-8 w-8 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}
