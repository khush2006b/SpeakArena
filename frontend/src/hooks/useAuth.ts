/**
 * useAuth hook — Primary Auth Consumer
 *
 * The single composable interface for all authentication state and actions.
 * Components import THIS hook, not the raw Zustand store.
 *
 * Responsibilities:
 *   - Exposes current user, role, and auth status
 *   - Provides logout action (calls API + clears state)
 *   - Provides updateUser for optimistic profile updates
 *   - isInitialized gates route guards from firing before session restore
 */

"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { apiClient } from "@/services/api/client";
import { setAccessToken } from "@/services/api/interceptors";
import { disconnectNotificationSocket } from "@/services/socket.client";
import { ENDPOINTS } from "@/services/api/endpoints";
import { ROUTES } from "@/constants/routes";
import type { User, UserRole } from "@/types";

export interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  role: UserRole | null;
  isTeacher: boolean;
  isStudent: boolean;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
}

export function useAuth(): UseAuthReturn {
  const { user, isAuthenticated, isInitialized, clearUser, updateUser } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const logout = useCallback(async () => {
    try {
      await apiClient.post(ENDPOINTS.AUTH.LOGOUT);
    } catch {
      // Best-effort — clear state regardless of API response
    } finally {
      setAccessToken(null);
      clearUser();
      // Disconnect all real-time sockets
      disconnectNotificationSocket();
      // Clear the full TanStack Query cache — prevents stale data bleed
      queryClient.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    }
  }, [clearUser, queryClient]);

  const role = user?.role?.toLowerCase() ?? null;
  const isTeacher = role === "teacher";
  const isStudent = isAuthenticated && role !== "teacher";

  return {
    user,
    isAuthenticated,
    isInitialized,
    role: user?.role ?? null,
    isTeacher,
    isStudent,
    logout,
    updateUser,
  };
}
