"use client";

import * as React from "react";
import { NotificationHeader } from "@/features/teacher/components/notifications/NotificationHeader";
import { NotificationCard } from "@/features/teacher/components/notifications/NotificationCard";
import { useNotificationsStore } from "@/stores/notifications.store";
import { useTeacherNotifications } from "@/hooks/queries/useTeacherQueries";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

const ActivityTimeline = dynamic(() => import("@/features/teacher/components/notifications/ActivityTimeline").then(mod => mod.ActivityTimeline), {
  loading: () => <Skeleton className="w-full h-full bg-border/30 rounded-2xl" />,
  ssr: false
});

export function NotificationFeed() {
  const { activeCategory, searchQuery } = useNotificationsStore();

  const { data, isLoading } = useTeacherNotifications({ page: 1, pageSize: 50 });
  const allNotifications = data?.items ?? [];

  let filtered = allNotifications;
  if (activeCategory === "unread") {
    filtered = filtered.filter(n => !n.isRead);
  } else if (activeCategory !== "inbox" && activeCategory !== "activity") {
    const typeFilter = activeCategory.slice(0, -1).toUpperCase();
    filtered = filtered.filter(n => n.type === typeFilter || n.type === activeCategory.toUpperCase());
  }

  if (searchQuery) {
    filtered = filtered.filter(n =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.body.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent relative min-w-0">
      <NotificationHeader />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeCategory === "activity" ? (
          <ActivityTimeline />
        ) : (
          <div className="flex flex-col p-4 sm:p-6 lg:p-8 space-y-4 max-w-4xl mx-auto w-full">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
              </div>
            ) : filtered.length > 0 ? (
              filtered.map(notification => (
                <NotificationCard key={notification.id} notification={notification as any} />
              ))
            ) : (
              <div className="card-glass flex flex-col items-center justify-center py-24 text-center px-4 mt-4 animate-fade-up">
                <div className="h-20 w-20 bg-card/60 rounded-full flex items-center justify-center mb-6 ring-1 ring-border/50">
                  <span className="text-3xl">🎉</span>
                </div>
                <h3 className="font-extrabold text-2xl mb-2 tracking-tight text-foreground">Inbox Zero</h3>
                <p className="text-sm font-semibold text-muted-foreground">You are all caught up! No notifications in this view.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
