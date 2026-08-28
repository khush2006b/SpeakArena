/**
 * Theme provider wrapper.
 *
 * Wraps next-themes ThemeProvider with our application's preferred
 * defaults. next-themes injects a tiny inline script before page
 * render to apply the correct theme class, eliminating FOUC
 * (Flash of Unstyled Content) completely.
 *
 * Supported modes: 'light', 'dark', 'system' (OS preference).
 * The resolved theme class ('dark' or '') is applied to <html>.
 */

"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="dark"
      forcedTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}
