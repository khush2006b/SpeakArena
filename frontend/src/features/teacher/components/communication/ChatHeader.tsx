"use client";

import * as React from "react";
import { Hash, PanelRightClose, PanelRightOpen, Users, BellOff } from "lucide-react";
import { useCommunicationStore } from "@/stores/communication.store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ChatHeader() {
  const {
    activeChannelId,
    channels,
    isRightPanelOpen,
    toggleRightPanel,
    moderationMode,
    setModerationMode,
  } = useCommunicationStore();

  const channel = channels.find((c) => c.id === activeChannelId) ?? channels[0];

  return (
    <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-white/5 bg-background/95 backdrop-blur-md z-20 shadow-sm">
      <div className="flex items-center gap-3">
        <Hash className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-base font-extrabold text-foreground m-0 leading-none">
            {channel?.name ?? "Select a channel"}
          </h2>
          {channel && !channel.isPrivate && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {channel.type === "course" ? "Course Channel" : channel.type}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={moderationMode ? "destructive" : "outline"}
          size="sm"
          onClick={() => setModerationMode(!moderationMode)}
          className={cn(
            "h-8 rounded-xl transition-all font-semibold press-scale",
            moderationMode
              ? "bg-red-500/15 border-red-500/25 text-red-500 hover:bg-red-500/20"
              : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10"
          )}
        >
          {moderationMode ? "Exit Moderation Mode" : "Moderation Tools"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 bg-transparent text-muted-foreground hover:text-foreground border-none press-scale"
        >
          <BellOff className="h-4 w-4" />
        </Button>
        <Button
          variant={isRightPanelOpen ? "secondary" : "ghost"}
          size="icon"
          onClick={toggleRightPanel}
          className={cn(
            "h-8 w-8 border-none rounded-xl press-scale text-muted-foreground hover:text-foreground",
            isRightPanelOpen ? "bg-white/5" : "bg-transparent"
          )}
        >
          {isRightPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
