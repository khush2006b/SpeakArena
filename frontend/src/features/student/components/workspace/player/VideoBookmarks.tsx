"use client";

import * as React from "react";
import { Bookmark, Trash2, Clock } from "lucide-react";
import { usePlayerStore } from "@/stores/player.store";
import { formatTime } from "@/lib/format-time";
import { Button } from "@/components/ui/button";

export function VideoBookmarks() {
  const { bookmarks, addBookmark, deleteBookmark, currentTime } = usePlayerStore();

  const handleAddBookmark = () => {
    addBookmark({
      timestamp: currentTime,
      title: `Bookmark at ${formatTime(currentTime)}`
    });
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      
      <Button 
        onClick={handleAddBookmark}
        className="w-full text-xs h-9 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 shadow-none transition-all"
      >
        <Bookmark className="mr-1 h-3.5 w-3.5" />
        Bookmark {formatTime(currentTime)}
      </Button>

      <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar pb-10">
        {bookmarks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center opacity-60">
            <Bookmark className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">No bookmarks yet.<br/>Save important moments to review later.</p>
          </div>
        )}

        {bookmarks.map((bmark) => (
          <div key={bmark.id} className="flex items-center gap-3 p-3 bg-card border border-border/50 rounded-lg group hover:border-primary/30 transition-colors cursor-pointer">
            
            <div 
              className="flex-1 flex flex-col min-w-0"
              onClick={() => {
                const event = new CustomEvent('seekTo', { detail: bmark.timestamp });
                window.dispatchEvent(event);
              }}
            >
              <span className="text-sm font-medium text-foreground line-clamp-1">{bmark.title}</span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" /> {formatTime(bmark.timestamp)}
              </span>
            </div>

            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={() => deleteBookmark(bmark.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            
          </div>
        ))}
      </div>
    </div>
  );
}
