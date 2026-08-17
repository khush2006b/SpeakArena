/**
 * TeacherRoute — Role-Based Access Guard for Teacher Portal
 *
 * Wraps all /teacher/* pages. Ensures:
 *   1. User is authenticated
 *   2. User has TEACHER role
 *
 * Unauthorized students are redirected to their dashboard,
 * not to login (they're already authenticated).
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/constants/routes";

import { Loader2 } from "lucide-react";

interface TeacherRouteProps {
  children: React.ReactNode;
}

export function TeacherRoute({ children }: TeacherRouteProps) {
  const { isAuthenticated, isInitialized, isTeacher } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) return;

    if (!isAuthenticated) {
      router.replace(ROUTES.LOGIN);
      return;
    }

    if (!isTeacher) {
      // Authenticated but wrong role — send to their own dashboard
      router.replace(ROUTES.STUDENT.DASHBOARD);
    }
  }, [isAuthenticated, isInitialized, isTeacher, router]);

  if (!isInitialized || !isAuthenticated || !isTeacher) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
        <p className="text-sm text-muted-foreground font-medium">Loading session...</p>
      </div>
    );
  }

  return <>{children}</>;
}
