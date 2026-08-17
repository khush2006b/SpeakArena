"use client";

import * as React from "react";
import { ChatHeader } from "@/features/teacher/components/communication/ChatHeader";
import { MessageList } from "@/features/teacher/components/communication/MessageList";
import { MessageComposer } from "@/features/teacher/components/communication/MessageComposer";

export function ChatArea() {
  return (
    <div className="flex-1 flex flex-col h-full bg-background relative min-w-0">
      <ChatHeader />
      <MessageList />
      <MessageComposer />
    </div>
  );
}
