"use client";

import * as React from "react";
import { format } from "date-fns";
import { Pin, MoreHorizontal, FileText, Reply, Trash2, ShieldAlert } from "lucide-react";
import { Message } from "@/stores/communication.store";
import { useCommunicationStore } from "@/stores/communication.store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: Message;
  isSequential?: boolean;
}

export function MessageBubble({ message, isSequential }: MessageBubbleProps) {
  const { setReplyingToId, moderationMode } = useCommunicationStore();
  const time = format(new Date(message.timestamp), "h:mm a");

  if (message.type === "system") {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-white/5 border border-white/5 text-muted-foreground text-xs px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
          {message.isPinned && <Pin className="h-3 w-3" />}
          {message.content}
        </div>
      </div>
    );
  }

  const isTeacher = message.user?.role === "teacher";

  return (
    <div
      className={cn(
        "relative flex gap-4 px-4 py-1 group transition-colors duration-200",
        isSequential ? "mt-0" : "mt-4",
        message.isAnnouncement 
          ? "bg-primary/5 border-l-2 border-primary hover:bg-primary/10" 
          : "bg-transparent border-l-2 border-transparent hover:bg-white/5"
      )}
    >
      {/* Avatar Container */}
      <div className="w-10 shrink-0 flex justify-center">
        {!isSequential && message.user && (
          <div className="relative mt-1">
            <img
              src={message.user.avatar}
              alt={message.user.name}
              className={cn(
                "h-10 w-10 rounded-md object-cover shadow-sm",
                isTeacher ? "border-none outline outline-2 outline-offset-1 outline-primary/20" : "border border-white/5 outline-none"
              )}
            />
            {message.user.status === "online" && (
              <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
            )}
          </div>
        )}
        {isSequential && (
          <span className="text-[10px] text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {time}
          </span>
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        {!isSequential && message.user && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className={cn("font-extrabold text-[15px]", isTeacher ? "text-primary" : "text-foreground")}>
              {message.user.name}
            </span>
            {isTeacher && (
              <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-primary/10 text-primary">
                TEACHER
              </span>
            )}
            <span className="text-xs text-muted-foreground">{time}</span>
            {message.isPinned && <Pin className="h-3 w-3 text-amber-500" />}
          </div>
        )}

        <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap pr-12">
          {message.content}
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.attachments.map((file: any, i: number) => {
              const rawUrl = file.url || file.r2_key || file.path || "";
              const fileName = file.name || file.file_name || "Attachment";
              const isImage =
                file.mime_type?.startsWith("image/") ||
                file.type?.includes("image") ||
                /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(rawUrl || fileName);
              const photoSrc =
                rawUrl.startsWith("http://") || rawUrl.startsWith("https://") || rawUrl.startsWith("data:")
                  ? rawUrl
                  : `https://pub-24a225d578474f4fb5b75f2a90813a11.r2.dev/${rawUrl.replace(/^\//, "")}`;

              if (isImage && photoSrc) {
                return (
                  <div
                    key={i}
                    className="rounded-xl overflow-hidden border border-white/10 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(photoSrc, "_blank")}
                  >
                    <img
                      src={photoSrc}
                      alt={fileName}
                      className="max-w-[260px] max-h-[200px] object-cover rounded-xl block"
                    />
                  </div>
                );
              }

              return (
                <div
                  key={i}
                  onClick={() => photoSrc && window.open(photoSrc, "_blank")}
                  className="flex items-center gap-2 py-2 pr-3 pl-2 rounded-xl border border-white/5 bg-white/5 cursor-pointer transition-colors shadow-sm hover:border-primary/50"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                      {fileName}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase">{file.type || "file"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hover Actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 top-2 bg-background border border-white/10 shadow-sm rounded-md flex items-center overflow-hidden">
        {moderationMode && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-none text-red-500 bg-transparent hover:bg-red-500/10 transition-colors press-scale"
          >
            <ShieldAlert className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-none text-muted-foreground bg-transparent hover:text-foreground hover:bg-white/5 transition-colors press-scale"
          onClick={() => setReplyingToId(message.id)}
        >
          <Reply className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-none text-muted-foreground bg-transparent hover:text-foreground hover:bg-white/5 transition-colors press-scale"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-xl border-border shadow-2xl">
            <DropdownMenuItem className="font-medium cursor-pointer">Copy Message Link</DropdownMenuItem>
            <DropdownMenuItem className="font-medium cursor-pointer">Pin to Channel</DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem className="text-red-400 focus:text-red-400 focus:bg-red-500/10 font-medium cursor-pointer">
              <Trash2 className="mr-2 h-4 w-4" /> Delete Message
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
