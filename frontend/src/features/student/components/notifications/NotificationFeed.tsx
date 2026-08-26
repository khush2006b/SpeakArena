"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStudentNotificationsStore } from "@/stores/student-notifications.store";
import { NotificationCard } from "./NotificationCard";
import { motion, AnimatePresence } from "framer-motion";
import { useMarkAllNotificationsRead } from "@/hooks/queries/useNotificationQueries";

export function NotificationFeed() {
  const { notifications, activeCategory } =
    useStudentNotificationsStore();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const filteredNotifications = React.useMemo(() => {
    let result = notifications;

    // Filter by Category
    if (activeCategory === "unread") {
      result = result.filter((n) => !n.isRead);
    } else if (activeCategory !== "all") {
      result = result.filter(
        (n) => n.type?.toLowerCase() === activeCategory.toLowerCase()
      );
    }

    // Sort by timestamp desc
    return result.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [notifications, activeCategory]);

  const hasUnread = filteredNotifications.some((n) => !n.isRead);

  return (
    <div className="flex-1 flex flex-col min-w-0 border-r border-border/50 h-full relative">

      {/* Sticky Header */}
      <div className="shrink-0 p-4 border-b border-border/50 bg-background/95 backdrop-blur-xl z-10 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-foreground capitalize">
            {activeCategory === "all" ? "Inbox" : activeCategory.replace("_", " ")}
          </h2>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground press-scale"
              onClick={() => markAllReadMutation.mutate()}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Feed List */}
      <ScrollArea className="flex-1">
        <AnimatePresence initial={false}>
          {filteredNotifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-12 text-center opacity-60 flex flex-col items-center"
            >
              <div className="h-16 w-16 bg-secondary/50 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-bold text-foreground">
                You&apos;re all caught up!
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Inbox Zero achieved.
              </p>
            </motion.div>
          ) : (
            filteredNotifications.map((notification) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <NotificationCard notification={notification} />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}
