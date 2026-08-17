/**
 * TanStack Query provider wrapper.
 *
 * Wraps the application with QueryClientProvider using the
 * singleton QueryClient from lib/queryClient.ts. Also mounts
 * ReactQueryDevtools in development mode only (tree-shaken in
 * production builds automatically).
 *
 * This is a Client Component because QueryClientProvider requires
 * React context, which is a client-only API.
 */

"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "@/lib/queryClient";

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <>
        {children}
        {process.env["NODE_ENV"] === "development" && (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        )}
      </>
    </QueryClientProvider>
  );
}
