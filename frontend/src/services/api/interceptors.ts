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

// ---------------------------------------------------------------------------
// Token management (in-memory — never persisted to localStorage)
// ---------------------------------------------------------------------------

let accessToken: string | null = null;
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

export function setAccessToken(token: string | null): void {
  accessToken = token;
  // Access token is kept in memory ONLY — never persisted to storage.
  // (The sa_auth and sa_role cookies for middleware routing are managed by
  //  AuthProvider and useAuthQueries — not here.)
}

export function getAccessToken(): string | null {
  return accessToken;
}

function processQueue(error: unknown, token: string | null): void {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else if (token) {
      resolve(token);
    }
  });
  failedQueue = [];
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

    // --- 401: Attempt token refresh ---
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== ENDPOINTS.AUTH.REFRESH
    ) {
      if (isRefreshing) {
        // Queue requests while refresh is in progress
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.set("Authorization", `Bearer ${token}`);
            return apiClient(originalRequest);
          })
          .catch((err: unknown) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await apiClient.post<any>(ENDPOINTS.AUTH.REFRESH);
        // Backend returns { user, tokens: { accessToken } } — support multiple shapes
        const newAccessToken =
          data?.tokens?.accessToken ??
          data?.data?.access_token ??
          data?.access_token ??
          data?.data?.accessToken ?? null;
        if (!newAccessToken) throw new Error("No access token in refresh response");
        setAccessToken(newAccessToken);
        processQueue(null, newAccessToken);
        originalRequest.headers.set("Authorization", `Bearer ${newAccessToken}`);
        return apiClient(originalRequest);
      } catch (refreshError: unknown) {
        processQueue(refreshError, null);
        setAccessToken(null);
        // Redirect to login — handled by AuthProvider on next render
        if (typeof window !== "undefined") {
          window.location.href = "/login?reason=session_expired";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
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
