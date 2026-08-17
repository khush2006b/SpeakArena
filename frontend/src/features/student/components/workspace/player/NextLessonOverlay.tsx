"use client";

import * as React from "react";
import { PlayCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NextLessonOverlayProps {
  onCancel: () => void;
  onPlayNext: () => void;
  countdown: number;
  nextLessonTitle: string;
}

export function NextLessonOverlay({ onCancel, onPlayNext, countdown, nextLessonTitle }: NextLessonOverlayProps) {
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-20 flex items-center justify-center animate-in fade-in duration-500">
      <div className="bg-card/10 border border-white/20 p-8 rounded-3xl backdrop-blur-md max-w-lg w-full flex flex-col items-center text-center shadow-2xl relative">
        
        <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full" onClick={onCancel}>
          <X className="h-5 w-5" />
        </Button>

        <p className="text-white/70 font-semibold uppercase tracking-widest text-xs mb-4">Up Next in {countdown}s</p>
        <h3 className="text-2xl font-bold text-white mb-8">{nextLessonTitle}</h3>

        <div className="relative group cursor-pointer" onClick={onPlayNext}>
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-150 group-hover:bg-primary/40 transition-colors" />
          <Button size="icon" className="h-20 w-20 rounded-full bg-primary text-primary-foreground shadow-2xl hover:scale-105 transition-transform active:scale-95 relative z-10">
            <PlayCircle className="h-10 w-10 fill-current ml-1" />
          </Button>
          
          {/* SVG Progress Ring */}
          <svg className="absolute -inset-2 w-24 h-24 rotate-[-90deg]">
            <circle 
              cx="48" 
              cy="48" 
              r="46" 
              className="fill-none stroke-white/20" 
              strokeWidth="4" 
            />
            <circle 
              cx="48" 
              cy="48" 
              r="46" 
              className="fill-none stroke-primary transition-all duration-1000 linear" 
              strokeWidth="4" 
              strokeDasharray={289}
              strokeDashoffset={289 - (289 * ((10 - countdown) / 10))}
            />
          </svg>
        </div>

        <div className="mt-8 flex items-center gap-4">
          <Button variant="outline" className="bg-transparent border-white/20 text-white hover:bg-white/10" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="default" className="bg-white text-black hover:bg-white/90" onClick={onPlayNext}>
            Play Now
          </Button>
        </div>

      </div>
    </div>
  );
}
