/**
 * StudentRoute — Role-Based Access Guard for Student Portal
 *
 * Wraps all /student/* pages. Ensures:
 *   1. User is authenticated
 *   2. User has STUDENT role
 *
 * Teachers trying to access student pages are redirected to the
 * teacher dashboard, not to login.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/constants/routes";

import { Loader2 } from "lucide-react";

interface StudentRouteProps {
  children: React.ReactNode;
}

const LoadingScreen = () => (
  <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground">
    <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
    <p className="text-sm text-muted-foreground font-medium">Loading session...</p>
  </div>
);

export function StudentRoute({ children }: StudentRouteProps) {
  const { isAuthenticated, isInitialized, isStudent } = useAuth();
  const router = useRouter();
  // mounted prevents server/client HTML mismatch (#418) — auth state comes
  // from localStorage which is unavailable during SSR.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isInitialized) return;

    if (!isAuthenticated) {
      router.replace(ROUTES.LOGIN);
      return;
    }

    if (!isStudent) {
      router.replace(ROUTES.TEACHER.DASHBOARD);
    }
  }, [mounted, isAuthenticated, isInitialized, isStudent, router]);

  // Always render loading until mounted (prevents SSR mismatch)
  if (!mounted || !isInitialized || !isAuthenticated || !isStudent) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}
