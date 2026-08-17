"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { PlayCircle, Clock, Calendar } from "lucide-react";

interface RecordingsListProps {
  meetings?: any[];
}

export function RecordingsList({ meetings = [] }: RecordingsListProps) {
  if (meetings.length === 0) return null;

  return (
    <div className="mt-16">
      <h3 className="text-responsive-lg font-bold text-foreground mb-6">
        Recent Recordings
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {meetings.slice(0, 4).map((recording) => (
          <div
            key={recording.id}
            className="card-glass hover-lift overflow-hidden cursor-pointer flex flex-col"
          >
            <div className="h-28 bg-secondary relative overflow-hidden rounded-t-2xl">
              {/* Note: the backend does not return recording thumbnails or specific URLs yet. Using placeholder. */}
              <img
                src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='400' viewBox='0 0 800 400'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%231e1b4b'/><stop offset='100%' stop-color='%234338ca'/></linearGradient></defs><rect width='800' height='400' fill='url(%23g)'/></svg>"
                alt={recording.title}
                className="w-full h-full object-cover opacity-50 hover:opacity-70 transition-opacity"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <PlayCircle className="h-10 w-10 text-foreground opacity-80 hover:scale-110 transition-transform" />
              </div>
              <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur text-foreground text-[10px] font-bold px-1.5 py-0.5 rounded border border-border/50">
                {recording.durationMinutes}:00
              </div>
            </div>

            <div className="p-3 flex-1 flex flex-col">
              <h4 className="font-semibold text-sm text-foreground line-clamp-1 mb-2">
                {recording.title}
              </h4>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-auto">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />{" "}
                  {format(parseISO(recording.scheduledAt), "MMM d, yyyy")}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />{" "}
                  {format(parseISO(recording.scheduledAt), "h:mm a")}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {meetings.length > 4 && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            className="bg-secondary/30 border-border press-scale"
          >
            View All Recordings
          </Button>
        </div>
      )}
    </div>
  );
}
