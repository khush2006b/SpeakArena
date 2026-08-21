"use client";

import * as React from "react";
import Link from "next/link";
import { UserPlus, MonitorPlay, MessageSquare, Video, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeacherActivity } from "@/hooks/queries/useTeacherQueries";
import { formatDistanceToNow, parseISO } from "date-fns";

const TYPE_CONFIG = {
  enrollment: { icon: UserPlus, iconColor: "#60a5fa", iconBg: "rgba(59,130,246,0.15)" },
  course: { icon: MonitorPlay, iconColor: "hsl(270 80% 60%)", iconBg: "hsla(270,80%,60%,0.15)" },
  meeting: { icon: Video, iconColor: "#fb923c", iconBg: "rgba(249,115,22,0.15)" },
  message: { icon: MessageSquare, iconColor: "#34d399", iconBg: "rgba(16,185,129,0.15)" },
  payment: { icon: DollarSign, iconColor: "#34d399", iconBg: "rgba(16,185,129,0.15)" },
  upload: { icon: MonitorPlay, iconColor: "#60a5fa", iconBg: "rgba(59,130,246,0.15)" },
} as const;

export function ActivityFeed() {
  const { data: activities, isLoading } = useTeacherActivity(6);

  return (
    <div className="card-glass hover-lift rounded-2xl bg-card border border-border overflow-hidden flex flex-col">
      <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-foreground m-0 tracking-tight">Activity Feed</h3>
        <Link href="/teacher/notifications" className="text-[11px] font-bold text-violet-400 hover:text-violet-300 transition-colors no-underline">
          View all
        </Link>
      </div>
      <div className="p-4 overflow-y-auto custom-scrollbar max-h-[280px]">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-2.5">
                <Skeleton className="w-6 h-6 rounded-full bg-border shrink-0" />
                <div className="flex-1 flex flex-col gap-1">
                  <Skeleton className="h-3 w-3/4 bg-border" />
                  <Skeleton className="h-2.5 w-12 bg-border" />
                </div>
              </div>
            ))}
          </div>
        ) : !activities || activities.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4 m-0">No recent activity.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {activities.map((activity) => {
              const config = TYPE_CONFIG[activity.type] ?? TYPE_CONFIG.course;
              const Icon = config.icon;
              let timeAgo = "";
              try {
                timeAgo = formatDistanceToNow(parseISO(activity.timestamp), { addSuffix: true });
              } catch {
                timeAgo = "recently";
              }
              return (
                <div key={activity.id} className="flex items-start gap-2.5 p-2 -mx-1 rounded-lg hover:bg-muted/30 transition-colors">
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5"
                    style={{ background: config.iconBg }}
                  >
                    <Icon className="w-2.5 h-2.5" style={{ color: config.iconColor }} />
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <p className="text-xs text-foreground font-medium m-0 leading-tight">{activity.description}</p>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{timeAgo}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
