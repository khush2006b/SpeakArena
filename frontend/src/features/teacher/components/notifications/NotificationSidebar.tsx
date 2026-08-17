"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import {
  Inbox,
  Bell,
  CreditCard,
  Users,
  Video,
  UploadCloud,
  MessageSquare,
  Activity,
  CheckCircle2
} from "lucide-react";
import { useNotificationsStore } from "@/stores/notifications.store";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiClient } from "@/services/api/client";
import { toast } from "sonner";

const CATEGORIES = [
  { id: "inbox", label: "Inbox", icon: Inbox, isMain: true },
  { id: "unread", label: "Unread", icon: Bell, isMain: true },
  { id: "activity", label: "Activity Timeline", icon: Activity, isMain: true },
  { id: "divider1", type: "divider" },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "students", label: "Students", icon: Users },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "meetings", label: "Live Meetings", icon: Video },
  { id: "uploads", label: "Uploads", icon: UploadCloud },
];

export function NotificationSidebar() {
  const { activeCategory, setActiveCategory } = useNotificationsStore();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await apiClient.get("/api/v1/notifications", { params: { page: 1, page_size: 50 } });
      setNotifications(res.data?.data || []);
    } catch (err) {
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await apiClient.post(`/api/v1/notifications/${id}/read`);
      setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      toast.error("Failed to mark as read");
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="w-full h-full flex flex-col bg-card/60 backdrop-blur-xl border-r border-border/50 p-4 sm:p-6 overflow-y-auto">
      <div className="space-y-1.5 mb-8">
        {CATEGORIES.map((cat, i) => {
          if (cat.type === "divider") {
            return <div key={i} className="my-4 border-t border-border/40 mx-2" />;
          }

          const Icon = cat.icon!;
          const isActive = activeCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 group press-scale",
                isActive
                  ? "bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/30"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", isActive ? "text-violet-400" : "text-muted-foreground group-hover:text-foreground")} />
                <span>{cat.label}</span>
              </div>

              {(cat.id === "inbox" || cat.id === "unread") && unreadCount > 0 && (
                <Badge
                  variant={isActive ? "secondary" : "default"}
                  className={cn(
                    "h-5 px-1.5 min-w-5 flex items-center justify-center text-[10px] font-bold rounded-md",
                    isActive ? "bg-violet-500 text-foreground" : "bg-card/80 text-muted-foreground border-border/50"
                  )}
                >
                  {unreadCount}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 space-y-4">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Recent Notifications</h4>
        {notifications.slice(0, 10).map((notif) => (
          <div key={notif.id} className={cn("p-3 rounded-xl border border-border/50 text-sm flex gap-3 transition-colors", !notif.isRead ? "bg-white/5" : "bg-transparent")}>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{notif.title}</p>
              <p className="text-muted-foreground text-xs mt-1">{notif.message || notif.body}</p>
              <p className="text-[10px] text-muted-foreground mt-2">{new Date(notif.createdAt || notif.time).toLocaleString()}</p>
            </div>
            {!notif.isRead && (
              <button 
                onClick={() => markAsRead(notif.id)}
                className="text-violet-400 hover:text-violet-300 self-start p-1"
                title="Mark as read"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
