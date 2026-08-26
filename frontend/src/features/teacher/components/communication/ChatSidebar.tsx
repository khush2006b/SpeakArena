"use client";

import * as React from "react";
import { 
  Hash, 
  Megaphone, 
  Video, 
  MessageSquare,
  Users,
  Loader2
} from "lucide-react";
import { useCommunicationStore, Channel } from "@/stores/communication.store";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function ChannelIcon({ type }: { type: Channel["type"] }) {
  switch (type) {
    case "announcement": return <Megaphone className="h-4 w-4 text-amber-500" />;
    case "live":         return <Video className="h-4 w-4 text-emerald-500" />;
    case "direct":       return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
    default:             return <Hash className="h-4 w-4 text-muted-foreground" />;
  }
}

export function ChatSidebar() {
  const { activeChannelId, setActiveChannelId, channels, channelsLoading, fetchChannels } =
    useCommunicationStore();

  React.useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const filtered = channels;

  const grouped = filtered.reduce(
    (acc, channel) => {
      if (channel.isPrivate) acc.direct.push(channel);
      else if (channel.type === "announcement") acc.announcements.push(channel);
      else if (channel.type === "live") acc.live.push(channel);
      else acc.courses.push(channel);
      return acc;
    },
    { announcements: [] as Channel[], live: [] as Channel[], courses: [] as Channel[], direct: [] as Channel[] }
  );

  const renderChannel = (channel: Channel) => {
    const isActive = activeChannelId === channel.id;
    return (
      <button
        key={channel.id}
        onClick={() => setActiveChannelId(channel.id)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 border-none cursor-pointer group",
          isActive
            ? "bg-primary/15 text-primary font-semibold"
            : "bg-transparent text-muted-foreground font-normal hover:bg-white/5 hover:text-foreground"
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <ChannelIcon type={channel.type} />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{channel.name}</span>
        </div>
        {channel.unreadCount > 0 && (
          <Badge
            className={cn(
              "h-5 px-1.5 min-w-[20px] flex items-center justify-center text-[10px] rounded-full border-none text-foreground",
              isActive ? "bg-primary" : "bg-white/10"
            )}
          >
            {channel.unreadCount}
          </Badge>
        )}
      </button>
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-background/50 border-r border-white/5">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-white/5">
        <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2 m-0">
          SpeakArena
          <Badge
            variant="outline"
            className="text-[10px] uppercase bg-primary/15 text-primary border-primary/25 rounded-full px-1.5 py-0.5"
          >
            Pro
          </Badge>
        </h2>
      </div>

      {/* Channel List */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-6 hide-scrollbar">
        {channelsLoading && (
          <div className="flex items-center gap-2 px-3 py-4 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading channels...
          </div>
        )}

        {!channelsLoading && grouped.announcements.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
              Announcements
            </div>
            {grouped.announcements.map(renderChannel)}
          </div>
        )}

        {!channelsLoading && grouped.live.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Live Sessions
            </div>
            {grouped.live.map(renderChannel)}
          </div>
        )}

        {!channelsLoading && grouped.courses.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
              Courses
            </div>
            {grouped.courses.map(renderChannel)}
          </div>
        )}

        {!channelsLoading && grouped.direct.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center justify-between">
              Direct Messages
              <Users className="h-3 w-3" />
            </div>
            {grouped.direct.map(renderChannel)}
          </div>
        )}

        {!channelsLoading && filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No channels found
          </div>
        )}
      </div>
    </div>
  );
}
