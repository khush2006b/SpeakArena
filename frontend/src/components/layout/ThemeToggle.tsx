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
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 text-indigo-400 cursor-default"
      title="SpeakArena Dark Mode (Active)"
    >
      <Moon className="h-4 w-4" />
      <span className="sr-only">Dark Mode</span>
    </Button>
  );
}
