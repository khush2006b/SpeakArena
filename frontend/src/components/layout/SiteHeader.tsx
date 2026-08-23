"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";

import { DesktopNav } from "./DesktopNav";
import { MobileNav } from "./MobileNav";
import { ThemeToggle } from "./ThemeToggle";
import { CommandPalette } from "./CommandPalette";
import { ProfileMenu } from "./ProfileMenu";
import { NotificationBell } from "./NotificationBell";

export function SiteHeader() {
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [searchFocused, setSearchFocused] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const isFullyAuth = mounted && isAuthenticated && Boolean(user);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 w-full transition-all duration-300",
          isScrolled
            ? "bg-background/90 backdrop-blur-xl border-b border-border shadow-sm"
            : "bg-background/70 backdrop-blur-md border-b border-border/50"
        )}
      >
        <div className="w-full flex h-14 items-center gap-4 section-pad">

          {/* LEFT: Logo + Desktop Nav */}
          <div className="flex items-center gap-6 flex-shrink-0">
            <Link
              href="/"
              className="flex items-center gap-2 transition-opacity hover:opacity-90"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm" style={{ boxShadow: "0 0 14px hsl(var(--primary) / 0.35)" }}>
                <span className="text-sm font-bold text-primary-foreground">S</span>
              </div>
              <span className="text-sm font-semibold tracking-tight text-foreground hidden sm:block">
                SpeakArena
              </span>
            </Link>

            {/* Desktop nav links */}
            <DesktopNav />
          </div>

          {/* CENTER: Search bar */}
          <div className="flex-1 flex items-center justify-center px-2 sm:px-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="What do you want to learn?"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="w-full"
                style={{
                  height: 36,
                  paddingLeft: 36, paddingRight: 58,
                  background: "hsl(var(--background))",
                  border: `1px solid ${searchFocused ? "hsl(var(--primary))" : "hsl(var(--border))"}`,
                  borderRadius: 9, fontSize: 13,
                  color: "hsl(var(--foreground))",
                  outline: "none",
                  boxShadow: searchFocused ? "0 0 0 3px hsl(var(--primary) / 0.12)" : "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5">
                <kbd className="text-[10px] text-muted-foreground bg-muted border border-border rounded px-1 py-0.5 font-mono">⌘</kbd>
                <kbd className="text-[10px] text-muted-foreground bg-muted border border-border rounded px-1 py-0.5 font-mono">K</kbd>
              </div>
            </div>
          </div>

          {/* RIGHT: Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <ThemeToggle />

            {isFullyAuth ? (
              <>
                <NotificationBell />
                <div className="hidden sm:block h-5 w-px bg-border" />
                <ProfileMenu />
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href={ROUTES.LOGIN}
                  className="hidden sm:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-accent"
                >
                  Log in
                </Link>
                <Link
                  href={ROUTES.REGISTER}
                  className="btn-primary press-scale hidden sm:inline-flex"
                  style={{ padding: "7px 16px", fontSize: 13, borderRadius: 9 }}
                >
                  Sign up
                </Link>
              </div>
            )}

            <MobileNav />
          </div>
        </div>
      </header>

      <CommandPalette />
    </>
  );
}
