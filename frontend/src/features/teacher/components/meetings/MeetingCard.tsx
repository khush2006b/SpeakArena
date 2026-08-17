"use client";

import * as React from "react";
import { format } from "date-fns";
import { Video, MoreVertical, Copy, Trash2, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useMeetingStore } from "@/stores/meeting.store";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MeetingCard({ meeting }: { meeting: any }) {
  const { setActiveMeeting } = useMeetingStore();

  const isCancelled = meeting.status === "CANCELLED";
  const isLive = meeting.status === "LIVE";
  const isCompleted = meeting.status === "ENDED";

  return (
    <div
      className={cn(
        "card-glass hover-lift press-scale group relative p-4 sm:p-5 flex flex-col gap-4 cursor-pointer animate-fade-up",
        isCancelled && "opacity-60 grayscale-[0.5]"
      )}
      onClick={() => setActiveMeeting(meeting)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5 pr-8">
          <h4
            className={cn(
              "text-base font-bold tracking-tight text-foreground line-clamp-1",
              isCancelled && "line-through opacity-70"
            )}
          >
            {meeting.title}
          </h4>
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground line-clamp-1">
            {meeting.courseName}
          </span>
        </div>

        {/* Status Badge */}
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 font-bold tracking-widest text-[9px] uppercase px-2 py-0.5",
            isLive
              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(52,211,153,0.2)] animate-pulse"
              : isCompleted
              ? "bg-secondary/50 text-muted-foreground border-border"
              : isCancelled
              ? "bg-red-500/15 text-red-400 border-red-500/30"
              : "bg-violet-500/15 text-violet-400 border-violet-500/30"
          )}
        >
          {isLive && (
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          )}
          {meeting.status}
        </Badge>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/50">
        <span className="font-semibold">
          {format(meeting.start, "h:mm a")} - {format(meeting.end, "h:mm a")}
        </span>

        {meeting.meetLink && !isCancelled && (
          <div className="flex items-center gap-1.5 text-violet-400 bg-violet-500/15 px-2 py-1 rounded-lg border border-violet-500/20">
            <Video className="h-3.5 w-3.5" />
            <span className="font-bold tracking-wide hidden sm:inline">Join</span>
          </div>
        )}
      </div>

      {/* Context Menu Overlay */}
      <div className="absolute right-3 top-3" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-card/95 backdrop-blur-xl border-border shadow-2xl">
            <DropdownMenuItem className="font-medium cursor-pointer">
              <Edit className="mr-2 h-4 w-4 text-muted-foreground" />
              Edit
            </DropdownMenuItem>
            {meeting.meetLink && (
              <DropdownMenuItem className="font-medium cursor-pointer">
                <Copy className="mr-2 h-4 w-4 text-muted-foreground" />
                Copy Link
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem className="font-medium text-red-400 focus:text-red-300 focus:bg-red-400/10 cursor-pointer">
              <Trash2 className="mr-2 h-4 w-4" />
              Cancel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
