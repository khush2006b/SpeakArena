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

let initialUser: User | null = null;
let initialToken: string | null = null;
if (typeof window !== "undefined") {
  try {
    const cachedUser = localStorage.getItem("sa_user");
    if (cachedUser) initialUser = JSON.parse(cachedUser);
    initialToken = localStorage.getItem("sa_at");
  } catch {}
}

export const useAuthStore = create<AuthStore>()((set) => ({
  user: initialUser,
  isInitialized: Boolean(initialUser && initialToken),
  isAuthenticated: Boolean(initialUser && initialToken),
  accessToken: initialToken,

  setUser: (user, accessToken) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("sa_user", JSON.stringify(user));
        localStorage.setItem("sa_at", accessToken);
      } catch {}
    }
    set({ user, accessToken, isAuthenticated: Boolean(user && accessToken) });
  },

  clearUser: () => {
    if (typeof document !== "undefined") {
      document.cookie = "sa_auth=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
      document.cookie = "sa_role=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    }
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("sa_user");
        localStorage.removeItem("sa_at");
      } catch {}
    }
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  setInitialized: () => set({ isInitialized: true }),

  updateUser: (patch) =>
    set((state) => {
      const newUser = state.user ? { ...state.user, ...patch } : null;
      if (newUser && typeof window !== "undefined") {
        try {
          localStorage.setItem("sa_user", JSON.stringify(newUser));
        } catch {}
      }
      return { user: newUser };
    }),
}));
