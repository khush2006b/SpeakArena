/**
 * Application root provider composition.
 *
 * Composes all global providers in the correct dependency order:
 *   QueryProvider → ThemeProvider → AuthProvider → ToastProvider
 *
 * This is the ONLY file that should be modified when adding new
 * global providers. Import this single component in the root layout.
 *
 * Provider order rationale:
 * 1. QueryProvider: Must wrap everything — auth check uses React Query
 * 2. ThemeProvider: Must wrap auth — toasts use theme tokens
 * 3. AuthProvider: Performs silent refresh, populates auth store
 * 4. ToastProvider: Renders toasts — must be inside all other providers
 */

"use client";

import * as React from "react";
import { QueryProvider } from "./QueryProvider";
import { ThemeProvider } from "./ThemeProvider";
import { AuthProvider } from "./AuthProvider";
import { ToastProvider } from "./ToastProvider";

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
