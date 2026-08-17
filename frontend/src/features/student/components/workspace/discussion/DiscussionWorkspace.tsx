"use client";

import * as React from "react";
import { useDiscussionStore } from "@/stores/discussion.store";
import { DiscussionLeftPanel } from "./DiscussionLeftPanel";
import { DiscussionRightPanel } from "./DiscussionRightPanel";
import { DiscussionFeed } from "./DiscussionFeed";
import { DiscussionThread } from "./DiscussionThread";

export function DiscussionWorkspace() {
  const { activeView } = useDiscussionStore();

  return (
    <div className="flex h-full w-full bg-background relative z-20 overflow-hidden">
      <DiscussionLeftPanel />
      
      {/* Center Canvas */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {activeView === "feed" ? <DiscussionFeed /> : <DiscussionThread />}
      </div>
      
      <DiscussionRightPanel />
    </div>
  );
}
