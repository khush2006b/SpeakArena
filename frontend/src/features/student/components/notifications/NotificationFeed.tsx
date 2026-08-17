"use client";

import * as React from "react";
import { Search, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStudentNotificationsStore } from "@/stores/student-notifications.store";
import { NotificationCard } from "./NotificationCard";
import { motion, AnimatePresence } from "framer-motion";
import { useMarkAllNotificationsRead } from "@/hooks/queries/useNotificationQueries";

export function NotificationFeed() {
  const { notifications, activeCategory, searchQuery, setSearchQuery } =
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

    // Filter by Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.title?.toLowerCase().includes(q) ||
          n.body?.toLowerCase().includes(q)
      );
    }

    // Sort by timestamp desc
    return result.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [notifications, activeCategory, searchQuery]);

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

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 bg-secondary/50 border-border/50 h-9 text-sm focus-visible:ring-primary/20"
          />
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
