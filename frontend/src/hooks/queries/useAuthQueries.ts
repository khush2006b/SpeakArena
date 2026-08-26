/**
 * Auth Query Hooks
 *
 * Primary integration surface between auth components and the backend.
 * All mock authentication has been replaced with real API calls.
 *
 * Cookie management:
 *   - sa_auth=1 and sa_role=TEACHER|STUDENT are client-set cookies
 *     used ONLY by middleware.ts for edge routing decisions.
 *   - The HttpOnly refresh_token cookie is managed exclusively by
 *     the backend — this module never touches it directly.
 *   - In-memory access token is managed by setAccessToken() in interceptors.ts.
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { authService, type LoginPayload, type RegisterPayload } from "@/services/auth.service";
import { setAccessToken } from "@/services/api/interceptors";
import { queryKeys } from "@/lib/queryKeys";
import { ROUTES } from "@/constants/routes";

// ---------------------------------------------------------------------------
// Cookie helpers — sets non-HttpOnly cookies for middleware routing
// ---------------------------------------------------------------------------

function setAuthCookies(role: string, rememberMe = false): void {
  if (typeof document === "undefined") return;
  // 30 days if remember-me, else 1 day (session-like)
  const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24;
  document.cookie = `sa_auth=1; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `sa_role=${role}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function clearAuthCookies(): void {
  if (typeof document === "undefined") return;
  document.cookie = "sa_auth=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  document.cookie = "sa_role=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
  // Clean up any legacy sa_at cookies
  document.cookie = "sa_at=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
}

// ---------------------------------------------------------------------------
// useLogin
// ---------------------------------------------------------------------------

export function useLogin() {
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: LoginPayload) => authService.login(payload),
    onSuccess: (data, variables) => {
      // 1. Store token in memory
      setAccessToken(data.tokens.accessToken);
      // 2. Populate Zustand store
      setUser(data.user, data.tokens.accessToken);
      // 3. Seed TanStack cache to prevent loading flash on first navigation
      queryClient.setQueryData(queryKeys.profile.me(), data.user);
      queryClient.setQueryData(queryKeys.auth.me(), data.user);
      // 4. Set client cookies for middleware edge routing
      //    Duration respects the rememberMe preference
      setAuthCookies(data.user.role, variables.rememberMe ?? false);
      // 5. Role-based redirect
      const role = data.user.role?.toLowerCase();
      router.push(
        role === "teacher"
          ? ROUTES.TEACHER.DASHBOARD
          : ROUTES.STUDENT.DASHBOARD,
      );
    },
  });
}

// ---------------------------------------------------------------------------
// useRegister
// ---------------------------------------------------------------------------

export function useRegister() {
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authService.register(payload),
    onSuccess: (_data) => {
      // DEV MODE: Email verification is skipped — redirect directly to login
      router.push(`/login?registered=1`);
    },
  });
}

// ---------------------------------------------------------------------------
// useLogout
// ---------------------------------------------------------------------------

export function useLogout() {
  const queryClient = useQueryClient();
  const { clearUser } = useAuthStore();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      // Always clear state regardless of API response
      setAccessToken(null);
      clearUser();
      clearAuthCookies();
      // Clear all cached server state — prevents stale data leaking between sessions
      queryClient.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    },
  });
}

// ---------------------------------------------------------------------------
// useForgotPassword
// ---------------------------------------------------------------------------

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authService.forgotPassword(email),
  });
}

// ---------------------------------------------------------------------------
// useVerifyEmail
// ---------------------------------------------------------------------------

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token: string) => authService.verifyEmail(token),
  });
}

// ---------------------------------------------------------------------------
// useResetPassword
// ---------------------------------------------------------------------------

export function useResetPassword() {
  return useMutation({
    mutationFn: (payload: { token: string; newPassword: string }) =>
      authService.resetPassword(payload),
  });
}

// ---------------------------------------------------------------------------
// useCurrentUser — background session re-validation
// ---------------------------------------------------------------------------

export function useCurrentUser() {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: () => authService.getMe(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
