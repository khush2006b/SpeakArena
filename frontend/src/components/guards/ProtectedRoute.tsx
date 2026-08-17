/**
 * ProtectedRoute — Client-Side Authentication Guard
 *
 * Wraps pages that require authentication. Waits for the session
 * restore (isInitialized) before making a routing decision.
 *
 * Flow:
 *   isInitialized=false → render nothing (session check in progress)
 *   isInitialized=true, !isAuthenticated → redirect to /login
 *   isInitialized=true, isAuthenticated → render children
 *
 * Note: Next.js middleware.ts is the FIRST line of defense at the
 * edge. This component is the SECOND line — it handles client-side
 * navigations that bypass the middleware (e.g., React state updates).
 */

"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/constants/routes";

import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isInitialized } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isInitialized) return;
    if (!isAuthenticated) {
      router.replace(`${ROUTES.LOGIN}?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, isInitialized, router, pathname]);

  if (!isInitialized || !isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
        <p className="text-sm text-muted-foreground font-medium font-sans">Loading session...</p>
      </div>
    );
  }

  return <>{children}</>;
}
