"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotificationsStore } from "@/stores/notifications.store";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const unreadCount = useNotificationsStore((state) => state.unreadCount);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-9 w-9 rounded-md border border-transparent hover:bg-accent/50"
      aria-label="View notifications"
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span
          className={cn(
            "absolute top-1.5 right-1.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground ring-2 ring-background",
            unreadCount > 9 && "h-3.5 w-3.5"
          )}
        >
          <span className="sr-only">{unreadCount} unread notifications</span>
        </span>
      )}
    </Button>
  );
}
