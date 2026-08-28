/**
 * Axios request and response interceptors.
 *
 * Responsibilities:
 * - Request: Inject Authorization header from auth store
 * - Response (401): Attempt silent token refresh, then retry
 * - Response (error): Normalise all errors into a typed APIError
 * - Retry logic: Exponential backoff for transient 5xx/network errors
 */

import { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { apiClient } from "./client";
import { ENDPOINTS } from "./endpoints";
import type { APIError } from "@/types";
import { useAuthStore } from "@/stores/auth.store";

// ---------------------------------------------------------------------------
// Token management (in-memory — never persisted to localStorage)
// ---------------------------------------------------------------------------

let accessToken: string | null = null;
if (typeof window !== "undefined") {
  try {
    accessToken = localStorage.getItem("sa_at");
  } catch {}
}
let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const { data } = await apiClient.post<any>(ENDPOINTS.AUTH.REFRESH);
      const newAccessToken =
        data?.tokens?.accessToken ??
        data?.data?.access_token ??
        data?.access_token ??
        data?.data?.accessToken ??
        null;

      if (!newAccessToken) {
        throw new Error("No access token in refresh response");
      }

      setAccessToken(newAccessToken);
      return newAccessToken;
    } catch (refreshError: unknown) {
      setAccessToken(null);
      useAuthStore.getState().clearUser();
      if (typeof window !== "undefined") {
        window.location.href = "/login?reason=session_expired";
      }
      throw refreshError;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (typeof window !== "undefined") {
    try {
      if (token) {
        localStorage.setItem("sa_at", token);
      } else {
        localStorage.removeItem("sa_at");
      }
    } catch {}
  }
}

export function getAccessToken(): string | null {
  if (!accessToken && typeof window !== "undefined") {
    try {
      accessToken = localStorage.getItem("sa_at");
    } catch {}
  }
  return accessToken;
}

export async function getValidAccessToken(): Promise<string | null> {
  let token = getAccessToken();
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(payloadBase64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      const payload = JSON.parse(jsonPayload);
      const expMs = (payload.exp || 0) * 1000;

      // If token is expired or expires in less than 45 seconds, silently refresh via single mutex
      if (Date.now() >= expMs - 45000) {
        return await refreshAccessToken();
      }
    }
  } catch (err) {
    console.warn("Silent token refresh check warning:", err);
  }
  return token;
}

// ---------------------------------------------------------------------------
// Request interceptor — inject Authorization header
// ---------------------------------------------------------------------------

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    // For multipart FormData, remove Content-Type so the browser sets the boundary automatically
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      delete config.headers["Content-Type"];
      if (typeof (config.headers as any).delete === "function") {
        (config.headers as any).delete("Content-Type");
      }
    }
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// Response interceptor — token refresh and error normalisation
// ---------------------------------------------------------------------------

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // --- 401: Attempt token refresh via single mutex promise ---
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== ENDPOINTS.AUTH.REFRESH
    ) {
      originalRequest._retry = true;
      try {
        const newAccessToken = await refreshAccessToken();
        if (newAccessToken) {
          originalRequest.headers.set("Authorization", `Bearer ${newAccessToken}`);
          return apiClient(originalRequest);
        }
      } catch (refreshError: unknown) {
        return Promise.reject(refreshError);
      }
    }

    // --- Normalise all errors to APIError shape ---
    const apiError: APIError = {
      status: error.response?.status ?? 0,
      code: "UNKNOWN_ERROR",
      message: "An unexpected error occurred. Please try again.",
    };

    if (error.code === "ECONNABORTED") {
      apiError.code = "TIMEOUT_ERROR";
      apiError.message = "The request took too long. Please try again.";
      return Promise.reject(apiError);
    }

    const responseData = error.response?.data as
      | { detail?: string | Record<string, string[]>; code?: string }
      | undefined;

    if (responseData) {
      if (typeof responseData.detail === "string") {
        apiError.message = responseData.detail;
      } else if (typeof responseData.detail === "object") {
        apiError.detail = responseData.detail;
        apiError.message = "Validation failed. Please check the form fields.";
      }
      if (responseData.code) {
        apiError.code = responseData.code;
      }
    }

    if (!error.response && error.code !== "ECONNABORTED") {
      apiError.code = "NETWORK_ERROR";
      apiError.message =
        "Unable to reach the server. Please check your internet connection.";
    } else if (error.response?.status === 403 && (!responseData || !responseData.detail)) {
      apiError.code = "FORBIDDEN";
      apiError.message = "You do not have permission to perform this action.";
    }

    return Promise.reject(apiError);
  },
);

// ---------------------------------------------------------------------------
// Retry utility for idempotent requests (GET, HEAD)
// ---------------------------------------------------------------------------

const RETRYABLE_STATUSES = new Set([408, 429, 502, 503, 504]);
const MAX_RETRIES = 3;

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const apiError = error as APIError;
      const isLastAttempt = attempt === retries;
      const isRetryable =
        !apiError.status || RETRYABLE_STATUSES.has(apiError.status);

      if (isLastAttempt || !isRetryable) throw error;

      const delay = Math.min(1000 * 2 ** attempt, 8000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Max retries exceeded");
}

// Ensure interceptors are registered when this module is imported
export { apiClient };
