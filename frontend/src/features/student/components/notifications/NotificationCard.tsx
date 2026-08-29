"use client";

import * as React from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useStudentNotificationsStore } from "@/stores/student-notifications.store";
import {
  Bell, Video, BookOpen, CreditCard, Settings, CheckCircle2, Archive, MessageSquare, FileText,
} from "lucide-react";
import { useMarkNotificationRead } from "@/hooks/queries/useNotificationQueries";

interface NotificationCardProps {
  notification: any;
}

const CATEGORY_ICONS: Record<string, any> = {
  SYSTEM: Settings,
  MEETING: Video,
  COURSE: BookOpen,
  PAYMENT: CreditCard,
  CHAT: MessageSquare,
  RESOURCES: FileText,
  RESOURCE_UPLOADED: FileText,
  COURSE_PUBLISHED: BookOpen,
};

export function NotificationCard({ notification }: NotificationCardProps) {
  const { selectedNotificationId, setSelectedNotificationId, archiveNotification } =
    useStudentNotificationsStore();
  const markAsReadMutation = useMarkNotificationRead();

  const isSelected = selectedNotificationId === notification.id;
  const notifType = (notification.type || "").toUpperCase();
  const Icon = CATEGORY_ICONS[notifType] || CATEGORY_ICONS[(notification.category || "").toUpperCase()] || Bell;
  const isUnread = !notification.isRead;

  const handleClick = () => {
    setSelectedNotificationId(notification.id);
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`relative flex items-start gap-4 p-4 cursor-pointer transition-all duration-200 border-b border-border/30 hover-lift ${
        isSelected
          ? "bg-primary/10 border-l-2 border-l-primary"
          : isUnread
          ? "bg-card/40"
          : "bg-transparent opacity-80"
      }`}
    >
      {/* Unread Indicator */}
      {isUnread && !isSelected && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
      )}

      {/* Icon */}
      <div className="relative shrink-0 mt-1">
        <div className="h-10 w-10 rounded-full bg-card border border-border flex items-center justify-center">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        {isUnread && (
          <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-8">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h4
            className={`text-sm truncate ${
              isUnread ? "font-extrabold text-foreground" : "font-medium text-foreground"
            }`}
          >
            {notification.title}
          </h4>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
            {formatDistanceToNow(parseISO(notification.createdAt), { addSuffix: true })}
          </span>
        </div>
        <p
          className={`text-xs line-clamp-1 ${
            isUnread ? "text-foreground font-medium" : "text-muted-foreground"
          }`}
        >
          {notification.body}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-card/90 backdrop-blur rounded-md p-1 border border-border/50">
        {isUnread && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              markAsReadMutation.mutate(notification.id);
            }}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
            title="Mark as read"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            archiveNotification(notification.id);
          }}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
          title="Archive"
        >
          <Archive className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
