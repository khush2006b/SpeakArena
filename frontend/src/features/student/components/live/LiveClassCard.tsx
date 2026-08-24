"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { Clock, Calendar, Video, ExternalLink } from "lucide-react";

interface LiveClassCardProps {
  liveClass: any;
  onJoinClick?: (liveClass: any) => void;
}

export function LiveClassCard({ liveClass, onJoinClick }: LiveClassCardProps) {
  const now = Date.now();
  let date: Date;
  try {
    date = parseISO(liveClass.scheduledAt);
    if (isNaN(date.getTime())) date = new Date();
  } catch {
    date = new Date();
  }
  const startMs = date.getTime();
  const durationMs = (liveClass.durationMinutes || 60) * 60 * 1000;
  const endMs = startMs + durationMs;

  const isCancelled = liveClass.status === "CANCELLED" || liveClass.status === "Cancelled";
  const isCompleted = liveClass.status === "ENDED" || liveClass.status === "COMPLETED" || now > endMs;
  const isInProgress = !isCancelled && !isCompleted && (now >= startMs && now <= endMs || liveClass.status === "LIVE");
  const isUpcoming = !isCancelled && !isCompleted && !isInProgress;

  const rawMeetLink = liveClass.meetLink || liveClass.meet_link || liveClass.meeting_url || "";
  const meetUrl = rawMeetLink.startsWith("http") ? rawMeetLink : `https://${rawMeetLink}`;
  const thumbnail = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='400' viewBox='0 0 800 400'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%231e1b4b'/><stop offset='100%' stop-color='%234338ca'/></linearGradient></defs><rect width='800' height='400' fill='url(%23g)'/></svg>`;

  return (
    <div
      className={`card-glass hover-lift overflow-hidden transition-all flex flex-col cursor-pointer ${
        isCancelled ? "opacity-60 grayscale" : ""
      }`}
      onClick={() => onJoinClick?.(liveClass)}
    >
      {/* Thumbnail Area */}
      <div className="h-32 relative overflow-hidden bg-secondary rounded-t-2xl">
        <img
          src={thumbnail}
          alt="Session"
          className="w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-opacity duration-700"
        />

        {/* Status Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {isInProgress && (
            <span className="bg-red-500/90 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded shadow-sm flex items-center gap-1.5 animate-pulse">
              <span className="h-1.5 w-1.5 bg-white rounded-full" /> Live Now
            </span>
          )}
          {isCancelled && (
            <span className="bg-secondary text-muted-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-border/50">
              Cancelled
            </span>
          )}
          {isCompleted && (
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded backdrop-blur-md">
              Completed
            </span>
          )}
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        {/* Course & Topic */}
        <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1 line-clamp-1">
          {liveClass.courseName || liveClass.courseTitle || liveClass.course_title || "Course Session"}
        </p>
        <h3 className="text-base font-bold text-foreground leading-tight mb-4 line-clamp-2">
          {liveClass.title}
        </h3>

        {/* Time Info */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>{format(date, "MMM d, yyyy")}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              {format(date, "h:mm a")} • {liveClass.durationMinutes} mins
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-auto">
          {isInProgress ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onJoinClick?.(liveClass);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/25 transition-all press-scale"
            >
              <Video className="h-4 w-4" />
              Join Live Class
              <ExternalLink className="h-3.5 w-3.5 opacity-70 ml-auto" />
            </button>
          ) : isUpcoming ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onJoinClick?.(liveClass);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 border border-violet-500/30 transition-all press-scale"
            >
              <Video className="h-4 w-4 text-violet-400" />
              Scheduled ({format(date, "h:mm a")})
            </button>
          ) : (
            <div className="w-full py-2 px-3 rounded-xl bg-secondary/30 text-center text-xs font-semibold text-muted-foreground border border-border/40">
              Session Ended
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
