"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Video, FileText, Bell, Users, Search } from "lucide-react";
import { useStudentLayoutStore } from "@/stores/student-layout.store";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

export function GlobalSearch() {
  const { isSearchOpen, setSearchOpen } = useStudentLayoutStore();
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setSearchOpen]);

  const runCommand = React.useCallback((command: () => void) => {
    setSearchOpen(false);
    command();
  }, [setSearchOpen]);

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start sm:pr-12 md:w-64 lg:w-80 border-none hover:bg-white/5 transition-colors gap-2"
        onClick={() => setSearchOpen(true)}
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af" }}
      >
        <Search className="h-4 w-4 shrink-0" style={{ color: "#6b7280" }} />
        <span className="hidden lg:inline-flex font-normal text-xs">Search courses, videos, notes...</span>
        <span className="inline-flex lg:hidden font-normal text-xs">Search...</span>
        <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-6 select-none items-center gap-1 px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex"
             style={{ background: "rgba(255,255,255,0.1)", borderRadius: 4, color: "#e5e7eb" }}>
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={isSearchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="What do you want to learn today?" />
        <CommandList style={{ background: "#0b0e18" }}>
          <CommandEmpty style={{ color: "#9ca3af" }}>No results found.</CommandEmpty>
          
          <CommandGroup heading="Recent Courses">
            <CommandItem onSelect={() => runCommand(() => router.push('/student/courses/1'))} className="focus:bg-white/5">
              <BookOpen className="mr-2 h-4 w-4" style={{ color: "#818cf8" }} />
              <span style={{ color: "#e5e7eb" }}>Advanced Frontend Architecture</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/student/courses/2'))} className="focus:bg-white/5">
              <BookOpen className="mr-2 h-4 w-4" style={{ color: "#818cf8" }} />
              <span style={{ color: "#e5e7eb" }}>UI/UX Principles</span>
            </CommandItem>
          </CommandGroup>
          
          <CommandSeparator style={{ background: "rgba(255,255,255,0.07)" }} />
          
          <CommandGroup heading="Lessons & Media">
            <CommandItem onSelect={() => runCommand(() => router.push('/student/courses/1/lessons/3'))} className="focus:bg-white/5">
              <Video className="mr-2 h-4 w-4" style={{ color: "#f59e0b" }} />
              <span style={{ color: "#e5e7eb" }}>React Server Components Explained</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/student/courses/2/resources/1'))} className="focus:bg-white/5">
              <FileText className="mr-2 h-4 w-4" style={{ color: "#10b981" }} />
              <span style={{ color: "#e5e7eb" }}>Design System Cheatsheet.pdf</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator style={{ background: "rgba(255,255,255,0.07)" }} />

          <CommandGroup heading="Community & Updates">
            <CommandItem onSelect={() => runCommand(() => router.push('/student/live'))} className="focus:bg-white/5">
              <Users className="mr-2 h-4 w-4" style={{ color: "#4f46e5" }} />
              <span style={{ color: "#e5e7eb" }}>Upcoming Live QA Session</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/student/notifications'))} className="focus:bg-white/5">
              <Bell className="mr-2 h-4 w-4" style={{ color: "#ef4444" }} />
              <span style={{ color: "#e5e7eb" }}>New course announcement: Next.js 15</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
