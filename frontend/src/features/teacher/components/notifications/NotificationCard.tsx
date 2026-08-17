"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { 
  CreditCard, 
  Users, 
  Video, 
  Settings, 
  MessageSquare, 
  UploadCloud,
  CheckCircle2,
  MoreVertical,
  Archive,
  Loader2
} from "lucide-react";
import { useNotificationsStore } from "@/stores/notifications.store";
import { useMarkNotificationRead } from "@/hooks/queries/useTeacherQueries";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const getTypeIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case "payment": return <CreditCard className="h-4 w-4" />;
    case "student": return <Users className="h-4 w-4" />;
    case "meeting": return <Video className="h-4 w-4" />;
    case "system": return <Settings className="h-4 w-4" />;
    case "message": return <MessageSquare className="h-4 w-4" />;
    case "upload": return <UploadCloud className="h-4 w-4" />;
    default: return <Settings className="h-4 w-4" />;
  }
};

const getPriorityColor = (priority?: string) => {
  switch (priority?.toLowerCase()) {
    case "critical": return "text-red-400 bg-red-500/10 border-red-500/30 shadow-[0_0_15px_rgba(248,113,113,0.3)]";
    case "high": return "text-orange-400 bg-orange-500/10 border-orange-500/30 shadow-[0_0_15px_rgba(251,146,60,0.3)]";
    case "medium": return "text-blue-400 bg-blue-500/10 border-blue-500/30 shadow-[0_0_15px_rgba(96,165,250,0.3)]";
    default: return "text-muted-foreground bg-white/10 border-white/20";
  }
};

export function NotificationCard({ notification }: { notification: any }) {
  const { activeNotificationId, setActiveNotificationId } = useNotificationsStore();
  const markReadMutation = useMarkNotificationRead();
  const isActive = activeNotificationId === notification.id;

  const handleMarkAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
  };

  return (
    <div 
      onClick={() => setActiveNotificationId(notification.id)}
      className={cn(
        "group relative flex items-start gap-4 p-5 border-b border-transparent cursor-pointer transition-all duration-300 rounded-2xl mb-2",
        isActive ? "bg-primary/5 border-white/5 ring-1 ring-primary/20 shadow-[inset_0_1px_1px_bg-white/5]" : "hover:bg-white/[0.02] border-white/5",
        !notification.isRead && !isActive ? "bg-white/[0.01]" : ""
      )}
    >
      {/* Unread Indicator */}
      {!notification.isRead && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-primary rounded-r-md shadow-[0_0_15px_rgba(var(--primary-rgb),0.8)]" />
      )}

      {/* Icon */}
      <div className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-105",
        getPriorityColor(notification.priority)
      )}>
        {getTypeIcon(notification.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5 mt-0.5">
        <div className="flex items-center justify-between gap-2">
          <h4 className={cn("text-[15px] truncate transition-colors", !notification.isRead ? "font-extrabold text-foreground group-hover:text-primary" : "font-bold text-muted-foreground group-hover:text-foreground")}>
            {notification.title}
          </h4>
          <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground opacity-70 shrink-0 whitespace-nowrap">
            {formatDistanceToNow(new Date(notification.createdAt || notification.timestamp), { addSuffix: true })}
          </span>
        </div>
        
        <p className="text-sm font-semibold text-muted-foreground opacity-90 line-clamp-2 pr-12 leading-relaxed">
          {notification.body || notification.description}
        </p>

        {/* Metadata Footer */}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          {notification.studentName && (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {notification.studentAvatar && <img src={notification.studentAvatar} alt={notification.studentName} className="h-5 w-5 rounded-full border border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.5)]" />}
              <span className="font-bold text-foreground">{notification.studentName}</span>
            </div>
          )}
          {notification.courseName && (
            <span className="truncate max-w-[150px] bg-white/5 px-2 py-1 rounded-md text-[10px] uppercase font-bold tracking-widest border border-white/10 shadow-[inset_0_1px_1px_bg-white/5]">
              {notification.courseName}
            </span>
          )}
        </div>
      </div>

      {/* Hover Actions */}
      <div className="absolute right-5 top-5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-background/90 backdrop-blur-xl p-1.5 rounded-xl border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors press-scale"
          onClick={handleMarkAsRead}
          disabled={notification.isRead || markReadMutation.isPending}
        >
          {markReadMutation.isPending && !notification.isRead ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors press-scale">
          <Archive className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors press-scale">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
