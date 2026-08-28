"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { Clock, Calendar, Video, ExternalLink } from "lucide-react";

import { getMeetingStatus } from "@/lib/utils";

interface LiveClassCardProps {
  liveClass: any;
  onJoinClick?: (liveClass: any) => void;
}

export function LiveClassCard({ liveClass, onJoinClick }: LiveClassCardProps) {
  const [nowMs, setNowMs] = React.useState<number>(Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  const currentStatus = getMeetingStatus(liveClass, nowMs);

  let date: Date;
  try {
    const startIso = liveClass.scheduledAt || liveClass.scheduled_at;
    date = parseISO(startIso);
    if (isNaN(date.getTime())) date = new Date();
  } catch {
    date = new Date();
  }

  const durationMins = liveClass.durationMinutes || liveClass.duration_minutes || 60;
  const thumbnail = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='400' viewBox='0 0 800 400'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%231e1b4b'/><stop offset='100%' stop-color='%234338ca'/></linearGradient></defs><rect width='800' height='400' fill='url(%23g)'/></svg>`;

  return (
    <div
      className={`card-glass hover-lift overflow-hidden transition-all flex flex-col cursor-pointer ${
        currentStatus === "CANCELLED" ? "opacity-60 grayscale" : ""
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
          {currentStatus === "LIVE" && (
            <span className="bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded shadow-sm flex items-center gap-1.5 animate-pulse">
              <span className="h-1.5 w-1.5 bg-white rounded-full" /> Live Now
            </span>
          )}
          {currentStatus === "UPCOMING" && (
            <span className="bg-violet-500/20 text-violet-300 border border-violet-500/30 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded backdrop-blur-md">
              Upcoming
            </span>
          )}
          {currentStatus === "ENDED" && (
            <span className="bg-slate-500/20 text-slate-400 border border-slate-500/30 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded backdrop-blur-md">
              Ended
            </span>
          )}
          {currentStatus === "CANCELLED" && (
            <span className="bg-secondary text-muted-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-border/50">
              Cancelled
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
              {format(date, "h:mm a")} • {durationMins} mins
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-auto">
          {currentStatus === "LIVE" ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onJoinClick?.(liveClass);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/25 transition-all press-scale"
            >
              <Video className="h-4 w-4" />
              Join Live Class Now
              <ExternalLink className="h-3.5 w-3.5 opacity-70 ml-auto" />
            </button>
          ) : currentStatus === "UPCOMING" ? (
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
            <div className="w-full py-2.5 px-3 rounded-xl bg-secondary/30 text-center text-xs font-bold text-muted-foreground border border-border/40 uppercase tracking-wider">
              Ended
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
