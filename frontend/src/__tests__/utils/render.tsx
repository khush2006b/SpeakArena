/**
 * Test utility helpers.
 *
 * Provides a custom render() wrapper that includes all application providers,
 * and other helpers to reduce boilerplate in test files.
 *
 * Usage:
 *   import { render, screen, userEvent } from "@/__tests__/utils/render";
 *
 * This re-exports everything from @testing-library/react so tests only
 * need one import.
 */

import React from "react";
import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { MockUser } from "@/__tests__/factories";

// ---------------------------------------------------------------------------
// Provider wrapper
// ---------------------------------------------------------------------------

/** Creates a fresh QueryClient per-test to prevent cache bleeding. */
function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Disable retries in tests — we want immediate failures
        retry: false,
        // Disable stale-time so every render triggers the mock
        staleTime: 0,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  /** Pre-populate the QueryClient with cached data before rendering. */
  initialQueryData?: Record<string, unknown>;
  /** Override the current authenticated user in the session context. */
  currentUser?: MockUser | null;
}

/**
 * Custom render function that wraps the component under test with all
 * required application providers (QueryClient, etc.).
 *
 * Returns everything @testing-library/react's render returns, plus:
 *   - `queryClient`: The QueryClient instance for manual cache manipulation.
 *   - `user`: A pre-configured userEvent instance (pointer events enabled).
 */
export function render(
  ui: React.ReactElement,
  {
    initialQueryData = {},
    currentUser: _currentUser,
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  const queryClient = makeTestQueryClient();

  // Pre-populate cache if requested
  Object.entries(initialQueryData).forEach(([key, value]) => {
    queryClient.setQueryData(JSON.parse(key), value);
  });

  function AllProviders({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  const result = rtlRender(ui, {
    wrapper: AllProviders,
    ...renderOptions,
  });

  // userEvent.setup() — pointer events enabled, no fake timers by default
  const user = userEvent.setup();

  return {
    ...result,
    queryClient,
    user,
  };
}

// ---------------------------------------------------------------------------
// Re-export everything from RTL for a single import path
// ---------------------------------------------------------------------------

export * from "@testing-library/react";
export { userEvent };
