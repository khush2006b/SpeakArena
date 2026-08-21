/**
 * TanStack Query client configuration.
 *
 * A singleton QueryClient is created here and shared across the
 * entire application via QueryProvider. The defaults are tuned
 * for a real-time-adjacent SaaS product:
 *
 * - staleTime: 2 minutes. Data is considered fresh for 2 minutes,
 *   avoiding redundant refetches on rapid navigation.
 * - gcTime: 5 minutes. Inactive cache entries are kept for 5 minutes,
 *   enabling instant back-navigation without a loading state.
 * - retry: Intelligent retry logic — 401/403/404 are not retried;
 *   network errors and 5xx are retried up to 3 times.
 * - refetchOnWindowFocus: true. Brings data up-to-date when the user
 *   returns to the tab after working elsewhere.
 */

import { QueryClient, QueryCache, MutationCache, type QueryClientConfig } from "@tanstack/react-query";
import type { APIError } from "@/types";
import { toast } from "sonner";

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 3) return false;

  const apiError = error as APIError | undefined;
  if (!apiError) return true;

  // Never retry auth or not-found errors — retrying won't help
  const nonRetryableStatuses = new Set([400, 401, 403, 404, 422]);
  if (nonRetryableStatuses.has(apiError.status)) return false;

  return true;
}

const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,       // 2 minutes
      gcTime: 5 * 60 * 1000,          // 5 minutes
      retry: shouldRetry,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
    mutations: {
      retry: false,
    },
  },
};

const handleGlobalError = (error: unknown) => {
  const apiError = error as APIError | undefined;
  if (!apiError) return;

  // We don't want to show global toasts for validation errors (handled by forms)
  // or 401s (handled by auth interceptor redirecting to login).
  if (apiError.status === 422 || apiError.status === 401) return;

  if (apiError.code === "NETWORK_ERROR") {
    toast.error("Network Error", {
      description: apiError.message,
      duration: 5000,
    });
  } else if (apiError.code === "TIMEOUT_ERROR") {
    toast.error("Request Timeout", {
      description: apiError.message,
      duration: 5000,
    });
  } else if (apiError.status && apiError.status >= 500) {
    toast.error("Server Error", {
      description: "Our servers are experiencing issues. We've been notified.",
      duration: 5000,
    });
  } else if (apiError.status === 403 || apiError.status === 404) {
    toast.error("Error", {
      description: apiError.message,
    });
  }
};

/**
 * Singleton QueryClient instance.
 *
 * Exported for use in QueryProvider. Also accessible directly in
 * Server Components via the SSR dehydration pattern.
 */
export const queryClient = new QueryClient({
  ...queryClientConfig,
  queryCache: new QueryCache({
    onError: handleGlobalError,
  }),
  mutationCache: new MutationCache({
    onError: handleGlobalError,
  }),
});
