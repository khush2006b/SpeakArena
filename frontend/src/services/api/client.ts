/**
 * Axios HTTP client instance.
 *
 * This is the single, configured Axios instance used by every
 * service function in the application. Interceptors are applied
 * in interceptors.ts and attached to this instance.
 *
 * Configuration:
 * - baseURL: Reads from validated env config
 * - timeout: 15s (prevents hanging requests from blocking the UI)
 * - withCredentials: true (sends HttpOnly refresh token cookie automatically)
 * - Content-Type: application/json by default
 */

import axios, { type AxiosInstance } from "axios";

// Use absolute URL on the server (RSC), but relative URL in the browser (proxy)
const BASE_URL = typeof window === "undefined"
  ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
  : "";

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});
