"use client";

import * as React from "react";
import { X, FileText, MessageSquare, Download, Bookmark } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWorkspaceStore, RightSidebarTab } from "@/stores/workspace.store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useParams } from "next/navigation";
import { useLectureDetail } from "@/hooks/queries/useCourseQueries";
import { TimestampNotes } from "./player/TimestampNotes";
import { VideoBookmarks } from "./player/VideoBookmarks";

export function WorkspaceRightSidebar() {
  const { isRightSidebarOpen, isFullscreen, toggleRightSidebar, activeRightTab, setActiveRightTab } = useWorkspaceStore();
  const params = useParams();
  
  const courseId = params?.courseId as string;
  const lectureId = params?.lectureId as string;

  const { data: lecture } = useLectureDetail(courseId, lectureId);

  if (isFullscreen) return null;

  const tabs: { id: RightSidebarTab, icon: any, label: string }[] = [
    { id: "notes", icon: FileText, label: "Notes" },
    { id: "resources", icon: Download, label: "Files" },
    { id: "discussion", icon: MessageSquare, label: "Q&A" },
    { id: "bookmarks", icon: Bookmark, label: "Saved" },
  ];

  return (
    <AnimatePresence initial={false}>
      {isRightSidebarOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="h-full shrink-0 border-l border-border/40 bg-background/50 backdrop-blur-xl flex flex-col z-40 relative overflow-hidden"
        >
          {/* Header & Tabs */}
          <div className="flex flex-col shrink-0 border-b border-border/40">
            <div className="h-14 flex items-center justify-between px-4">
              <h2 className="font-semibold text-foreground truncate capitalize">{activeRightTab}</h2>
              <Button variant="ghost" size="icon" onClick={toggleRightSidebar} className="h-8 w-8 text-muted-foreground">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex px-2 pb-2 gap-1 overflow-x-auto hide-scrollbar-on-mobile">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeRightTab === tab.id;
                return (
                  <Button
                    key={tab.id}
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setActiveRightTab(tab.id)}
                    className={`h-8 rounded-full px-3 text-xs ${isActive ? "bg-secondary text-foreground font-medium shadow-sm border border-border/50" : "text-muted-foreground"}`}
                  >
                    <Icon className="h-3.5 w-3.5 mr-1.5" />
                    {tab.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Content Area (Mocking Notes & Resources for now) */}
          <ScrollArea className="flex-1 custom-scrollbar bg-secondary/5">
            <div className="p-4 space-y-4">
              
              {activeRightTab === "notes" && (
                <div className="h-full">
                  <TimestampNotes />
                </div>
              )}

              {activeRightTab === "bookmarks" && (
                <div className="h-full">
                  <VideoBookmarks />
                </div>
              )}

              {activeRightTab === "resources" && (
                <div className="space-y-2">
                  {lecture?.resourceIds && lecture.resourceIds.length > 0 ? (
                    lecture.resourceIds.map((resId) => (
                      <div key={resId} className="flex items-center gap-3 p-3 bg-card border border-border/50 rounded-lg hover:bg-secondary/30 transition-colors cursor-pointer group">
                        <div className="h-8 w-8 rounded bg-secondary flex items-center justify-center shrink-0">
                          <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-sm font-medium text-foreground line-clamp-1">Resource {resId}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">PDF • Download</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No resources available for this lecture.
                    </div>
                  )}
                </div>
              )}

              {activeRightTab === "discussion" && (
                <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 opacity-60">
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground max-w-[200px]">
                    This feature is currently under development.
                  </p>
                </div>
              )}

            </div>
          </ScrollArea>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
