"use client";

import * as React from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { useStudentNotificationsStore } from "@/stores/student-notifications.store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, ArrowRight, Archive } from "lucide-react";
import { motion } from "framer-motion";

export function NotificationDetails() {
  const { notifications, selectedNotificationId, archiveNotification } =
    useStudentNotificationsStore();

  const notification = notifications.find((n) => n.id === selectedNotificationId);

  if (!notification) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 opacity-50 bg-card/20">
        <Bell className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-sm font-medium text-muted-foreground">
          Select a notification to view details
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">

      {/* Header Actions */}
      <div className="shrink-0 p-4 border-b border-border/50 flex justify-end gap-2 bg-card/30 backdrop-blur">
        <Button
          variant="outline"
          size="sm"
          className="bg-secondary/50 border-border text-muted-foreground hover:text-foreground rounded-lg press-scale"
          onClick={() => archiveNotification(notification.id)}
        >
          <Archive className="h-4 w-4 mr-2" /> Archive
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <motion.div
          key={notification.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 max-w-2xl mx-auto w-full"
        >
          <div className="mb-8">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2 block">
              {format(parseISO(notification.createdAt), "EEEE, MMMM d 'at' h:mm a")}
            </span>
            <h1 className="text-2xl font-extrabold text-foreground leading-tight mb-2">
              {notification.title}
            </h1>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20 mt-2">
              {notification.type}
            </span>
          </div>

          <div className="text-muted-foreground leading-relaxed mb-8">
            <p className="text-base whitespace-pre-wrap">{notification.body}</p>
          </div>

          {(notification.action_url || notification.actionUrl || notification.resourceId || notification.entity_id) && (
            <div className="mt-8 pt-8 border-t border-border/50">
              <Link href={notification.action_url || notification.actionUrl || "/student/resources"}>
                <Button className="btn-primary press-scale" size="lg">
                  {notification.entity_type === "video" || notification.entity_type === "pdf" || notification.type === "resource_uploaded"
                    ? "Open Resource"
                    : "View Details"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
        </motion.div>
      </ScrollArea>
    </div>
  );
}
