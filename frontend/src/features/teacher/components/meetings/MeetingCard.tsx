"use client";

import * as React from "react";
import { format } from "date-fns";
import { Video, MoreVertical, Copy, Trash2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useMeetingStore } from "@/stores/meeting.store";
import { useDeleteMeeting } from "@/hooks/queries/useTeacherQueries";
import { toast } from "sonner";
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
  const deleteMeetingMutation = useDeleteMeeting();

  const now = Date.now();
  const startDate = meeting.start ? new Date(meeting.start) : new Date(meeting.scheduledAt || meeting.scheduled_at);
  const durationMs = (meeting.durationMinutes || meeting.duration_minutes || 60) * 60 * 1000;
  const endDate = meeting.end ? new Date(meeting.end) : new Date(startDate.getTime() + durationMs);

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  // Automatic time-based status determination
  const isCancelled = meeting.status === "CANCELLED" || meeting.status === "Cancelled";
  const isLive = !isCancelled && now >= startMs && now <= endMs;
  const isPast = !isCancelled && now > endMs;
  const isUpcoming = !isCancelled && now < startMs;

  const rawMeetLink = meeting.meetLink || meeting.meet_link || meeting.meeting_url || "";
  const meetUrl = rawMeetLink.startsWith("http") ? rawMeetLink : `https://${rawMeetLink}`;

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!rawMeetLink) {
      toast.error("No meeting link available.");
      return;
    }
    navigator.clipboard.writeText(meetUrl);
    toast.success("Google Meet link copied to clipboard!");
  };

  const handleCancelMeeting = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete session "${meeting.title}"?`)) return;

    deleteMeetingMutation.mutate(meeting.id, {
      onSuccess: () => {
        toast.success("Meeting deleted.");
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || "Failed to delete meeting.");
      },
    });
  };

  return (
    <div
      className={cn(
        "card-glass hover-lift press-scale group relative p-5 flex flex-col justify-between gap-4 cursor-pointer animate-fade-up border border-border/60 rounded-2xl bg-card/90 backdrop-blur-xl",
        isCancelled && "opacity-60 grayscale-[0.5]",
        isLive && "ring-2 ring-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
      )}
      onClick={() => setActiveMeeting({ ...meeting, start: startDate, end: endDate })}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1 pr-6">
            <h4
              className={cn(
                "text-base font-extrabold tracking-tight text-foreground line-clamp-1",
                isCancelled && "line-through opacity-70"
              )}
            >
              {meeting.title}
            </h4>
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary/80 line-clamp-1">
              {meeting.courseName || meeting.courseTitle || "Live Class Session"}
            </span>
          </div>

          {/* Status Badge */}
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 font-bold tracking-widest text-[9px] uppercase px-2.5 py-1 rounded-full",
              isLive
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_rgba(52,211,153,0.3)] animate-pulse"
                : isPast
                ? "bg-secondary/60 text-muted-foreground border-border"
                : isCancelled
                ? "bg-red-500/15 text-red-400 border-red-500/30"
                : "bg-violet-500/20 text-violet-300 border-violet-500/40"
            )}
          >
            {isLive && (
              <span className="h-2 w-2 rounded-full bg-emerald-400 mr-1.5 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-ping" />
            )}
            {isLive ? "LIVE NOW" : isPast ? "ENDED" : isCancelled ? "CANCELLED" : "UPCOMING"}
          </Badge>
        </div>

        {/* Date and Time info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
          <span className="font-semibold text-foreground/90">
            {format(startDate, "MMM d, yyyy")} • {format(startDate, "h:mm a")} - {format(endDate, "h:mm a")}
          </span>
          <span className="text-[11px] font-medium bg-secondary/40 px-2 py-0.5 rounded-md border border-border/50">
            {meeting.durationMinutes || 60} mins
          </span>
        </div>
      </div>

      {/* Primary Action Button: Direct Google Meet Link */}
      <div className="pt-2">
        {isLive ? (
          <a
            href={meetUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/25 transition-all press-scale"
          >
            <Video className="h-4 w-4" />
            Join Google Meet Now
            <ExternalLink className="h-3.5 w-3.5 opacity-70 ml-auto" />
          </a>
        ) : isUpcoming ? (
          <a
            href={rawMeetLink ? meetUrl : "#"}
            target={rawMeetLink ? "_blank" : "_self"}
            rel="noopener noreferrer"
            onClick={(e) => {
              if (!rawMeetLink) e.preventDefault();
              e.stopPropagation();
            }}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs transition-all press-scale",
              rawMeetLink
                ? "bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 border border-violet-500/30"
                : "bg-secondary/40 text-muted-foreground cursor-not-allowed border border-border/50"
            )}
          >
            <Video className="h-4 w-4 text-violet-400" />
            {rawMeetLink ? "Join Meeting Link" : `Opens at ${format(startDate, "h:mm a")}`}
            {rawMeetLink && <ExternalLink className="h-3.5 w-3.5 opacity-70 ml-auto" />}
          </a>
        ) : (
          <div className="w-full py-2 px-3 rounded-xl bg-secondary/30 text-center text-xs font-semibold text-muted-foreground border border-border/40">
            Session Ended
          </div>
        )}
      </div>

      {/* Context Options Menu */}
      <div className="absolute right-3 top-3" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors opacity-100 focus:opacity-100">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 bg-card/95 backdrop-blur-xl border-border shadow-2xl">
            {rawMeetLink && (
              <DropdownMenuItem className="font-medium cursor-pointer" onClick={handleCopyLink}>
                <Copy className="mr-2 h-4 w-4 text-muted-foreground" />
                Copy Meet Link
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem
              className="font-medium text-red-400 focus:text-red-300 focus:bg-red-400/10 cursor-pointer"
              onClick={handleCancelMeeting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Session
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
