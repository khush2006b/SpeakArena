/**
 * Authentication Provider — Session Restore
 *
 * Performs a silent session restore on every application mount:
 *
 *   POST /auth/refresh (sends HttpOnly refresh cookie automatically)
 *   ├── 200: Populates Zustand store with user + in-memory access token
 *   └── 401: Clears store (session expired or unauthenticated guest)
 *
 * This provider is the SINGLE point of session initialization.
 * After it sets isInitialized=true, the rest of the app can safely
 * branch on isAuthenticated without worrying about loading flickers.
 *
 * The auth check is async but children render immediately — layout
 * guards and route protection (middleware.ts) handle redirects.
 *
 * Additionally mounts the notification socket when authenticated.
 */

"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { apiClient } from "@/services/api/client";
import { setAccessToken } from "@/services/api/interceptors";
import { ENDPOINTS } from "@/services/api/endpoints";
// TODO: Re-enable when backend /ws/notifications endpoint is implemented
// import { connectNotificationSocket, disconnectNotificationSocket } from "@/services/socket.client";
import type { User } from "@/types";


interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { setUser, clearUser, setInitialized } = useAuthStore();

  // ── Silent session restore on mount ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function silentRefresh(): Promise<void> {
      try {
        const { data } = await apiClient.post<any>(
          ENDPOINTS.AUTH.REFRESH,
        );
        // Backend RefreshResponse = { access_token, token_type } — no user field.
        // After getting the new token, fetch /auth/me to populate user state.
        const authData = data?.data ?? data;
        const token: string = authData?.access_token ?? authData?.accessToken;

        if (!token) throw new Error("No access token in refresh response");

        setAccessToken(token);

        // Fetch user profile with the new token
        const meRes = await apiClient.get<any>(ENDPOINTS.AUTH.ME);
        const user: User = meRes.data?.data ?? meRes.data;

        if (!cancelled && token && user) {
          setUser(user, token);
          // Keep middleware cookies in sync with server session
          const maxAge = 60 * 60 * 24 * 30;
          document.cookie = `sa_auth=1; path=/; max-age=${maxAge}; SameSite=Lax`;
          document.cookie = `sa_role=${user?.role}; path=/; max-age=${maxAge}; SameSite=Lax`;
        }
      } catch {
        // 401 or network error — clear session state
        if (!cancelled) {
          setAccessToken(null);
          clearUser();
        }
      } finally {
        if (!cancelled) {
          setInitialized();
        }
      }
    }

    void silentRefresh();

    return () => {
      cancelled = true;
    };
  }, [setUser, clearUser, setInitialized]);

  // TODO: Re-enable when backend /ws/notifications endpoint is implemented
  // Real-time notifications are currently handled via TanStack Query polling.
  // useEffect(() => {
  //   if (!isAuthenticated) return;
  //   connectNotificationSocket();
  //   return () => { disconnectNotificationSocket(); };
  // }, [isAuthenticated]);

  return <>{children}</>;
}
