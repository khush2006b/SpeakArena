"use client";

import * as React from "react";
import { Moon, Sun, Monitor, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 text-muted-foreground"
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors relative"
          title="Toggle Day/Night Theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-400" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-indigo-400" />
          <span className="sr-only">Toggle Day/Night theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px] bg-card border-border text-foreground rounded-xl shadow-2xl p-1">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className="flex items-center justify-between cursor-pointer rounded-lg text-xs font-semibold focus:bg-white/10"
        >
          <span className="flex items-center gap-2">
            <Sun className="h-3.5 w-3.5 text-amber-400" /> Day Mode (Light)
          </span>
          {theme === "light" && <Check className="h-3.5 w-3.5 text-emerald-400" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="flex items-center justify-between cursor-pointer rounded-lg text-xs font-semibold focus:bg-white/10"
        >
          <span className="flex items-center gap-2">
            <Moon className="h-3.5 w-3.5 text-indigo-400" /> Night Mode (Dark)
          </span>
          {theme === "dark" && <Check className="h-3.5 w-3.5 text-emerald-400" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className="flex items-center justify-between cursor-pointer rounded-lg text-xs font-semibold focus:bg-white/10"
        >
          <span className="flex items-center gap-2">
            <Monitor className="h-3.5 w-3.5 text-muted-foreground" /> System Preference
          </span>
          {theme === "system" && <Check className="h-3.5 w-3.5 text-emerald-400" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
