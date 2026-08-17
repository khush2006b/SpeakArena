"use client";

import * as React from "react";
import { NotificationSidebar } from "./NotificationSidebar";
import { NotificationFeed } from "./NotificationFeed";
import { NotificationDetails } from "./NotificationDetails";
import { ActivityTimeline } from "./ActivityTimeline";
import { NotificationSettings } from "./NotificationSettings";
import { useStudentNotificationsStore } from "@/stores/student-notifications.store";
import { useNotificationList } from "@/hooks/queries/useNotificationQueries";
import { Loader2 } from "lucide-react";

export function NotificationsDashboard() {
  const { viewMode, setNotifications } = useStudentNotificationsStore();
  const { data, isLoading } = useNotificationList({ page: 1, pageSize: 100 });

  // Hydrate store on mount/fetch
  React.useEffect(() => {
    if (data?.items) {
      setNotifications(data.items);
    }
  }, [data?.items, setNotifications]);

  return (
    <div className="flex-1 w-full h-[calc(100vh-4rem)] flex overflow-hidden bg-background animate-fade-up">

      {/* 1. Left Sidebar (Filters, Navigation) */}
      <NotificationSidebar />

      {/* 2 & 3. Main Content Area */}
      <div className="flex-1 flex min-w-0">

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          </div>
        ) : viewMode === "inbox" && (
          <>
            {/* Center: Feed List */}
            <div className="w-full max-w-[450px] shrink-0 border-r border-border/50">
              <NotificationFeed />
            </div>
            {/* Right: Details Pane */}
            <NotificationDetails />
          </>
        )}

        {viewMode === "timeline" && <ActivityTimeline />}

        {viewMode === "settings" && <NotificationSettings />}

      </div>
    </div>
  );
}
