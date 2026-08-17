"use client";

import * as React from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { MessageBubble } from "@/features/teacher/components/communication/MessageBubble";
import { useCommunicationStore } from "@/stores/communication.store";
import { format, isToday, isYesterday, parseISO } from "date-fns";

function DateDivider({ timestamp }: { timestamp: string }) {
  const date = parseISO(timestamp);
  const label = isToday(date)
    ? "Today"
    : isYesterday(date)
    ? "Yesterday"
    : format(date, "MMMM d, yyyy");

  return (
    <div className="flex items-center justify-center my-6 relative">
      <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 border-t border-border" />
      <span className="relative bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border border-border rounded-full">
        {label}
      </span>
    </div>
  );
}

export function MessageList() {
  const { activeChannelId, messages, messagesLoading, fetchMessages } = useCommunicationStore();
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (activeChannelId) fetchMessages(activeChannelId);
  }, [activeChannelId, fetchMessages]);

  // Auto-scroll to bottom on new messages
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px 0",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        minHeight: 0,
        background: "rgba(8,12,20,0.5)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          maxWidth: "1024px",
          margin: "0 auto",
          width: "100%",
          paddingBottom: "8px",
        }}
      >
        {messagesLoading && (
          <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading messages...</span>
          </div>
        )}

        {!messagesLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-7 w-7 text-primary/50" />
            </div>
            <p className="text-sm font-semibold text-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground">
              Be the first to send a message in this channel.
            </p>
          </div>
        )}

        {!messagesLoading && messages.length > 0 && (
          <>
            {/* Group messages by date and insert dividers */}
            {(() => {
              const elements: React.ReactNode[] = [];
              let lastDate = "";

              messages.forEach((msg, index) => {
                const msgDate = msg.timestamp.split("T")[0];
                if (msgDate !== lastDate) {
                  elements.push(
                    <DateDivider key={`divider-${msgDate}`} timestamp={msg.timestamp} />
                  );
                  lastDate = msgDate;
                }

                const prevMsg = messages[index - 1];
                const isSequential =
                  prevMsg &&
                  prevMsg.user?.id === msg.user?.id &&
                  msg.type !== "system" &&
                  prevMsg.type !== "system";

                elements.push(
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isSequential={!!isSequential}
                  />
                );
              });

              return elements;
            })()}
          </>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
