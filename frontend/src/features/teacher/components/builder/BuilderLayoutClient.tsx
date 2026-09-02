"use client";

/**
 * BuilderLayoutClient
 *
 * On desktop: sidebar + content shown side by side (original behaviour).
 * On mobile:  sidebar OR content shown full-screen, one at a time.
 *   - Default view is the sidebar (step list).
 *   - Tapping a step switches to the content view.
 *   - A "Steps" button in the header slides back to the sidebar.
 */

import * as React from "react";
import { Menu } from "lucide-react";
import { BuilderSidebar } from "./BuilderSidebar";
import { BuilderHeader } from "./BuilderHeader";

interface Props {
  children: React.ReactNode;
}

export function BuilderLayoutClient({ children }: Props) {
  // On mobile, start by showing the sidebar so the user picks a step.
  const [mobileShowSidebar, setMobileShowSidebar] = React.useState(true);

  return (
    <div className="fixed inset-0 z-[100] bg-background flex h-screen w-screen overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      {/* Mobile: full-screen when sidebar is active, hidden otherwise.     */}
      {/* Desktop: always visible at fixed width.                           */}
      <div
        className={[
          "flex-col h-full overflow-hidden",
          "w-full md:w-72",
          mobileShowSidebar ? "flex" : "hidden",
          "md:flex",
        ].join(" ")}
      >
        <BuilderSidebar onStepSelect={() => setMobileShowSidebar(false)} />
      </div>

      {/* ── Content area ─────────────────────────────────────────────────── */}
      {/* Mobile: full-screen when content is active, hidden otherwise.     */}
      {/* Desktop: always visible, takes remaining space.                   */}
      <div
        className={[
          "flex-col overflow-hidden flex-1",
          mobileShowSidebar ? "hidden" : "flex",
          "md:flex",
        ].join(" ")}
      >
        {/* Header with mobile "Steps" back-button injected */}
        <BuilderHeader
          mobileStepsButton={
            <button
              className="md:hidden flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-secondary text-foreground border border-border"
              onClick={() => setMobileShowSidebar(true)}
            >
              <Menu style={{ width: 14, height: 14 }} />
              Steps
            </button>
          }
        />

        <main className="flex-1 overflow-y-auto bg-secondary/10 relative">
          {children}
        </main>
      </div>
    </div>
  );
}