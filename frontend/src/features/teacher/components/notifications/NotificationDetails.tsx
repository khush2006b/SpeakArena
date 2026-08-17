"use client";

import * as React from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CreditCard,
  Users,
  Video,
  ArrowUpRight,
  Archive,
  CheckCircle2,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { useNotificationsStore } from "@/stores/notifications.store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useTeacherNotifications,
  useMarkNotificationRead,
} from "@/hooks/queries/useTeacherQueries";

export function NotificationDetails() {
  const { activeNotificationId, setActiveNotificationId, isRightPanelOpen } =
    useNotificationsStore();
  const markReadMutation = useMarkNotificationRead();

  // Fetch all notifications to find the selected one
  const { data } = useTeacherNotifications({ page: 1, pageSize: 50 });
  const notif: any = activeNotificationId
    ? data?.items?.find((n) => n.id === activeNotificationId)
    : null;

  if (!isRightPanelOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ width: 0, opacity: 0, x: 20 }}
        animate={{ width: 450, opacity: 1, x: 0 }}
        exit={{ width: 0, opacity: 0, x: 20 }}
        transition={{ duration: 0.3, type: "spring", bounce: 0 }}
        className="h-full flex flex-col bg-background/50 backdrop-blur-3xl border-l border-white/5 shrink-0 overflow-hidden relative shadow-[-20px_0_40px_rgba(0,0,0,0.3)] z-30"
      >
        {!notif ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
            <div className="h-20 w-20 bg-white/[0.02] border border-white/10 shadow-[inset_0_1px_1px_bg-white/5] rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="font-extrabold text-xl text-foreground mb-2 tracking-tight">No Notification Selected</h3>
            <p className="text-sm font-semibold opacity-70">
              Select a notification from the feed to view its complete details.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-20 shrink-0 flex items-center justify-between px-6 border-b border-white/5 bg-white/[0.02] z-20">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-muted-foreground hover:bg-white/10 hover:text-foreground rounded-xl transition-colors press-scale"
                  onClick={() => setActiveNotificationId(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <h3 className="font-extrabold text-lg tracking-tight uppercase">Details</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-xl transition-colors press-scale"
                >
                  <Archive className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-xl transition-colors press-scale"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-10 hide-scrollbar">
              {/* Top Meta */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Badge variant="outline" className="uppercase text-[10px] font-bold tracking-widest bg-white/5 border-white/10 text-muted-foreground">
                    {notif.type}
                  </Badge>
                  <span className="text-xs font-bold tracking-widest text-muted-foreground opacity-70 uppercase">
                    {format(new Date(notif.timestamp), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                </div>
                <h2 className="text-3xl font-extrabold text-foreground leading-tight tracking-tight mb-4 drop-shadow-sm">
                  {notif.title}
                </h2>
                <p className="text-[15px] font-semibold text-muted-foreground leading-relaxed">{notif.description}</p>
              </div>

              {/* Linked Entities */}
              <div className="space-y-4 pt-8 border-t border-white/5">
                {notif.studentName && (
                  <div className="flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-primary/30 hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)] cursor-pointer transition-all duration-300 group">
                    <div className="flex items-center gap-4">
                      {notif.studentAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={notif.studentAvatar}
                          alt={notif.studentName}
                          className="h-12 w-12 rounded-xl border border-white/10 object-cover shadow-[0_4px_10px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center transition-transform group-hover:scale-105">
                          <Users className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
                          Student
                        </span>
                        <span className="text-[15px] font-extrabold text-foreground group-hover:text-primary transition-colors">
                          {notif.studentName}
                        </span>
                      </div>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all duration-300 -translate-x-2 group-hover:translate-x-0" />
                  </div>
                )}

                {notif.courseName && (
                  <div className="flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(96,165,250,0.1)] cursor-pointer transition-all duration-300 group">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center transition-transform group-hover:scale-105">
                        <Video className="h-5 w-5 text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
                          Course
                        </span>
                        <span className="text-[15px] font-extrabold text-foreground truncate max-w-[200px] group-hover:text-blue-400 transition-colors">
                          {notif.courseName}
                        </span>
                      </div>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-blue-400 transition-all duration-300 -translate-x-2 group-hover:translate-x-0" />
                  </div>
                )}

                {notif.amount !== undefined && (
                  <div className="flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-emerald-500/30 hover:shadow-[0_0_20px_rgba(52,211,153,0.1)] cursor-pointer transition-all duration-300 group">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center transition-transform group-hover:scale-105">
                        <CreditCard className="h-5 w-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
                          Payment
                        </span>
                        <span className="text-[15px] font-extrabold text-foreground group-hover:text-emerald-400 transition-colors">
                          ${notif.amount.toFixed(2)} USD
                        </span>
                      </div>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-emerald-400 transition-all duration-300 -translate-x-2 group-hover:translate-x-0" />
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-6 border-t border-white/5 bg-white/[0.02] flex flex-col gap-3">
              <Button className="w-full h-12 rounded-xl font-bold tracking-wide shadow-[inset_0_1px_1px_hsl(var(--border))] press-scale">View Full Context</Button>
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl font-bold tracking-wide text-muted-foreground border-white/10 bg-white/5 hover:bg-white/10 hover:text-foreground transition-all press-scale"
                disabled={notif.isRead || markReadMutation.isPending}
                onClick={() => markReadMutation.mutate(notif.id)}
              >
                {markReadMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {notif.isRead ? "Already Read" : "Mark as Read"}
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
