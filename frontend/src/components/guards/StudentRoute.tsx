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

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/constants/routes";

import { Loader2 } from "lucide-react";

interface StudentRouteProps {
  children: React.ReactNode;
}

export function StudentRoute({ children }: StudentRouteProps) {
  const { isAuthenticated, isInitialized, isStudent } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) return;

    if (!isAuthenticated) {
      router.replace(ROUTES.LOGIN);
      return;
    }

    if (!isStudent) {
      // Authenticated teacher — redirect to teacher portal
      router.replace(ROUTES.TEACHER.DASHBOARD);
    }
  }, [isAuthenticated, isInitialized, isStudent, router]);

  if (!isInitialized || !isAuthenticated || !isStudent) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
        <p className="text-sm text-muted-foreground font-medium">Loading session...</p>
      </div>
    );
  }

  return <>{children}</>;
}
