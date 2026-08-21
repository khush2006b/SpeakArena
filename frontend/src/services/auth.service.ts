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
   * POST /auth/login
   * Exchanges credentials for an access token + sets cookie for refresh.
   */
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const { data } = await apiClient.post<APIResponse<any>>(
      ENDPOINTS.AUTH.LOGIN,
      {
        email: payload.email,
        password: payload.password,
        remember_me: payload.rememberMe ?? false,
      },
    );
    const authData = data.data;
    const mapped: AuthResponse = {
      user: authData.user,
      tokens: { accessToken: authData.access_token, tokenType: 'Bearer' },
    };
    setAccessToken(mapped.tokens.accessToken);
    return mapped;
  },

  /**
   * POST /auth/register
   * Creates a new account. Backend sends verification email.
   */
  register: async (payload: RegisterPayload): Promise<RegisterResponse> => {
    const { data } = await apiClient.post<APIResponse<any>>(
      ENDPOINTS.AUTH.REGISTER,
      {
        full_name: payload.fullName,
        fullName: payload.fullName,
        email: payload.email,
        password: payload.password,
      },
    );
    // Registration does not return tokens or auto-login
    return data.data;
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

  /**
   * POST /auth/forgot-password
   * Triggers a password-reset email to the given address.
   */
  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post(ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
  },

  /**
   * POST /auth/reset-password
   * Validates the reset token and updates the password.
   */
  resetPassword: async (payload: ResetPasswordPayload): Promise<void> => {
    await apiClient.post(ENDPOINTS.AUTH.RESET_PASSWORD, payload);
  },

  /**
   * POST /auth/verify-email
   * Verifies email using the token sent to the user's inbox.
   */
  verifyEmail: async (token: string): Promise<void> => {
    await apiClient.post(ENDPOINTS.AUTH.VERIFY_EMAIL, { token });
  },
};
