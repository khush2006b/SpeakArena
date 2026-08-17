/**
 * Authentication Zustand store.
 *
 * Holds the currently authenticated user and authentication state.
 * This store is the client-side mirror of the server session.
 *
 * Source of truth priority:
 *   Server (POST /auth/refresh) > This store > Component local state
 *
 * The store is populated by AuthProvider on app mount via silent
 * token refresh. It is cleared on logout.
 *
 * Security notes:
 *   - accessToken is stored in memory ONLY — never localStorage / sessionStorage
 *   - The refresh token is stored as an HttpOnly cookie by the backend
 *   - Zustand persist is intentionally NOT used for auth state
 */

import { create } from "zustand";
import type { User } from "@/types";

interface AuthState {
  /** Currently authenticated user. null if unauthenticated or not yet initialized. */
  user: User | null;
  /** True when the initial auth check (POST /auth/refresh) is complete. */
  isInitialized: boolean;
  /** Derived: true when user is not null. */
  isAuthenticated: boolean;
  /** In-memory access token. Never persisted. */
  accessToken: string | null;
}

interface AuthActions {
  setUser: (user: User, accessToken: string) => void;
  clearUser: () => void;
  setInitialized: () => void;
  /** Optimistic update — update user fields without full re-fetch */
  updateUser: (patch: Partial<User>) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()((set) => ({
  user: null,
  isInitialized: false,
  isAuthenticated: false,
  accessToken: null,

  setUser: (user, accessToken) =>
    set({ user, accessToken, isAuthenticated: Boolean(user && accessToken) }),

  clearUser: () => {
    if (typeof document !== "undefined") {
      document.cookie = "sa_auth=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
      document.cookie = "sa_role=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    }
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  setInitialized: () => set({ isInitialized: true }),

  updateUser: (patch) =>
    set((state) =>
      state.user ? { user: { ...state.user, ...patch } } : state
    ),
}));
