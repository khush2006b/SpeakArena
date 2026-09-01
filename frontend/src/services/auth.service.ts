/**
 * Auth Service — Integration Layer
 *
 * All API calls related to authentication are centralised here.
 * Components and hooks NEVER call apiClient directly — they go through
 * this service, which owns the request shape and response mapping.
 */

import { apiClient } from "@/services/api/client";
import { setAccessToken } from "@/services/api/interceptors";
import { ENDPOINTS } from "@/services/api/endpoints";
import type { User, AuthTokens, APIResponse } from "@/types";

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  /** Always 'student' for public sign-up */
  role?: "student";
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

export interface RegisterResponse {
  message: string;
  user: User;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export const authService = {
  /**
   * Redirect browser to backend Google OAuth login endpoint.
   * Backend will redirect to Google consent screen.
   */
  googleRedirect: () => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "https://speakarena.onrender.com";
    window.location.href = `${apiBase}/api/v1/auth/google/login`;
  },

  /**
   * POST /auth/logout
   * Revokes the refresh token server-side and clears the HttpOnly cookie.
   */
  logout: async (): Promise<void> => {
    await apiClient.post(ENDPOINTS.AUTH.LOGOUT);
    setAccessToken(null);
  },

  /**
   * POST /auth/refresh
   * Uses the HttpOnly cookie to issue a new access token. Called silently
   * by the interceptor on 401 — not typically called manually.
   */
  refresh: async (): Promise<{ accessToken: string }> => {
    const { data } = await apiClient.post<any>(ENDPOINTS.AUTH.REFRESH);
    // Backend returns { data: { access_token, user } } — same shape as login
    const authData = data?.data ?? data;
    const accessToken: string = authData?.access_token ?? authData?.accessToken;
    setAccessToken(accessToken);
    return { accessToken };
  },

  /**
   * GET /auth/me
   * Fetches the current authenticated user's profile from the token.
   */
  getMe: async (): Promise<User> => {
    const { data } = await apiClient.get<APIResponse<User>>(ENDPOINTS.AUTH.ME);
    return data.data;
  },
};

