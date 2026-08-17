"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, Video, PlayCircle, ExternalLink, XCircle } from "lucide-react";

interface LiveClassCardProps {
  liveClass: any;
  onJoinClick?: (liveClass: any) => void;
}

export function LiveClassCard({ liveClass, onJoinClick }: LiveClassCardProps) {
  const isCancelled = liveClass.status === "CANCELLED";
  const isCompleted = liveClass.status === "ENDED";
  const isInProgress = liveClass.status === "LIVE";
  const date = parseISO(liveClass.scheduledAt);

  const thumbnail = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='400' viewBox='0 0 800 400'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%231e1b4b'/><stop offset='100%' stop-color='%234338ca'/></linearGradient></defs><rect width='800' height='400' fill='url(%23g)'/></svg>`;

  return (
    <div
      className={`card-glass hover-lift overflow-hidden transition-all flex flex-col ${
        isCancelled ? "opacity-60 grayscale" : ""
      }`}
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
        <p className="text-xs font-semibold text-primary mb-1">Course Session</p>
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
            <Button
              className="w-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 press-scale"
              onClick={() => onJoinClick?.(liveClass)}
            >
              <Video className="mr-2 h-4 w-4" /> Join Class Now
            </Button>
          ) : liveClass.status === "SCHEDULED" ? (
            <Button
              className="btn-primary w-full press-scale"
              onClick={() => onJoinClick?.(liveClass)}
            >
              <ExternalLink className="mr-2 h-4 w-4" /> Pre-flight Check
            </Button>
          ) : isCompleted ? (
            <Button
              variant="outline"
              className="w-full bg-background hover:bg-secondary/50 border-border press-scale"
            >
              <PlayCircle className="mr-2 h-4 w-4" /> Watch Recording
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="w-full opacity-50 cursor-not-allowed"
            >
              <XCircle className="mr-2 h-4 w-4" /> Class Unavailable
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
