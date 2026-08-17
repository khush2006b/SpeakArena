"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { 
  Calendar, 
  CreditCard, 
  Settings, 
  User, 
  BookOpen, 
  Video, 
  MessageSquare, 
  Bell
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push('/teacher'))}>
            <Calendar className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
            <CommandShortcut>G D</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/teacher/courses'))}>
            <BookOpen className="mr-2 h-4 w-4" />
            <span>Courses</span>
            <CommandShortcut>G C</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/teacher/meetings'))}>
            <Video className="mr-2 h-4 w-4" />
            <span>Live Meetings</span>
            <CommandShortcut>G M</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/teacher/students'))}>
            <User className="mr-2 h-4 w-4" />
            <span>Students</span>
            <CommandShortcut>G S</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        
        <CommandGroup heading="Communication">
          <CommandItem onSelect={() => runCommand(() => router.push('/teacher/communications'))}>
            <MessageSquare className="mr-2 h-4 w-4" />
            <span>Messages</span>
            <CommandShortcut>C M</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/teacher/notifications'))}>
            <Bell className="mr-2 h-4 w-4" />
            <span>Notifications</span>
            <CommandShortcut>C N</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />

        <CommandGroup heading="Settings & Profile">
          <CommandItem onSelect={() => runCommand(() => router.push('/teacher/profile'))}>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
            <CommandShortcut>⇧⌘P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/teacher/settings'))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/teacher/revenue'))}>
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Revenue</span>
          </CommandItem>
        </CommandGroup>

      </CommandList>
    </CommandDialog>
  );
}
