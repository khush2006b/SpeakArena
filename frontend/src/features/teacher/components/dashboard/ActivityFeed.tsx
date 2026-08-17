"use client";

import * as React from "react";
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
  const { data: activities, isLoading } = useTeacherActivity(8);

  return (
    <div className="card-glass hover-lift rounded-2xl bg-card border border-border overflow-hidden h-full flex flex-col">
      <div className="p-4 sm:p-6 border-b border-border bg-muted/30 flex items-center justify-between">
        <h3 className="text-lg font-extrabold text-foreground m-0 tracking-tight">Activity Feed</h3>
        <button className="btn-ghost press-scale text-sm font-semibold text-[hsl(270,80%,60%)] bg-transparent border-none cursor-pointer">
          View all
        </button>
      </div>
      <div className="p-4 sm:p-6 flex-1 custom-scrollbar overflow-y-auto">
        {isLoading ? (
          <div className="ml-3 pl-5 border-l border-border flex flex-col gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-7 h-7 rounded-full bg-border shrink-0" />
                <div className="flex-1 flex flex-col gap-1">
                  <Skeleton className="h-4 w-3/4 bg-border" />
                  <Skeleton className="h-3 w-16 bg-border" />
                </div>
              </div>
            ))}
          </div>
        ) : !activities || activities.length === 0 ? (
          <p className="text-sm text-muted-foreground font-medium text-center m-0 py-4">
            No recent activity.
          </p>
        ) : (
          <div className="relative border-l border-border ml-3 pl-6 flex flex-col gap-6">
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
                <div key={activity.id} className="relative group">
                  <div
                    className="absolute -left-[38px] top-0.5 flex h-7 w-7 items-center justify-center rounded-full border-4 border-background z-10 transition-transform group-hover:scale-110"
                    style={{ background: config.iconBg }}
                  >
                    <Icon className="w-3 h-3" style={{ color: config.iconColor }} />
                  </div>
                  <div className="flex flex-col gap-1 -mt-1 p-2 -ml-2 rounded-lg hover:bg-muted/20 transition-colors border border-transparent hover:border-border">
                    <p className="text-sm text-foreground font-medium m-0">{activity.description}</p>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{timeAgo}</span>
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
