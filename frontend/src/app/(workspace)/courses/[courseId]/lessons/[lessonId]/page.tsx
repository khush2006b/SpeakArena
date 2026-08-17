"use client";

import * as React from "react";

import { WorkspaceHeader } from "@/features/student/components/workspace/WorkspaceHeader";
import { WorkspaceBottomNav } from "@/features/student/components/workspace/WorkspaceBottomNav";
import { LessonInformation } from "@/features/student/components/workspace/LessonInformation";
import { VideoPlayer } from "@/features/student/components/workspace/player/VideoPlayer";
import { PdfWorkspace } from "@/features/student/components/workspace/pdf/PdfWorkspace";
import { DiscussionWorkspace } from "@/features/student/components/workspace/discussion/DiscussionWorkspace";
import { MobileWorkspaceToolbar } from "@/features/student/components/workspace/mobile/MobileWorkspaceToolbar";
import { MobileCurriculumDrawer } from "@/features/student/components/workspace/mobile/MobileCurriculumDrawer";
import { Button } from "@/components/ui/button";



export default function LessonPage() {
  const [activeView, setActiveView] = React.useState<"video" | "pdf" | "discussion">("video");
  const [isMobileCurriculumOpen, setIsMobileCurriculumOpen] = React.useState(false);
  
  // Note: For demonstration, notes/discussion just switch views on mobile
  const handleOpenNotes = () => {
    alert("Mobile Notes Drawer would open here.");
  };

  const handleOpenDiscussion = () => {
    setActiveView("discussion");
  };
  return (
    <>
      <WorkspaceHeader />
      
      {/* Temporary Toggle for Demo */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex bg-secondary/80 backdrop-blur-md rounded-full border border-border/50 p-1 shadow-2xl">
        <Button variant={activeView === "video" ? "default" : "ghost"} size="sm" onClick={() => setActiveView("video")} className="rounded-full text-xs h-7">Video Lesson</Button>
        <Button variant={activeView === "pdf" ? "default" : "ghost"} size="sm" onClick={() => setActiveView("pdf")} className="rounded-full text-xs h-7">PDF Lesson</Button>
        <Button variant={activeView === "discussion" ? "default" : "ghost"} size="sm" onClick={() => setActiveView("discussion")} className="rounded-full text-xs h-7">Discussion</Button>
      </div>

      {activeView === "video" ? (
        <>
          {/* Scrollable Center Content */}
          <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col relative z-0">
            
            {/* Premium Video Player */}
            <div className="w-full bg-black shrink-0 border-b border-border/40 shadow-xl relative z-10 flex items-center justify-center">
              <div className="w-full max-w-[1600px] mx-auto">
                <VideoPlayer 
                  src="http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                  poster="https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=2070&auto=format&fit=crop"
                  nextLessonTitle="Data Fetching Patterns"
                  onLessonComplete={() => console.log("Lesson completed")}
                />
              </div>
            </div>

            {/* Below Video Content */}
            <div className="flex-1 bg-background/50 backdrop-blur-3xl">
              <LessonInformation />
            </div>
            
          </main>
          <WorkspaceBottomNav />
        </>
      ) : activeView === "pdf" ? (
        <main className="flex-1 overflow-hidden relative z-0 bg-background">
          <PdfWorkspace />
        </main>
      ) : (
        <main className="flex-1 overflow-hidden relative z-0 bg-background">
          <DiscussionWorkspace />
        </main>
      )}

      {/* Mobile Experience Overlays */}
      <MobileWorkspaceToolbar 
        onOpenCurriculum={() => setIsMobileCurriculumOpen(true)}
        onOpenNotes={handleOpenNotes}
        onOpenDiscussion={handleOpenDiscussion}
      />
      
      <MobileCurriculumDrawer 
        isOpen={isMobileCurriculumOpen}
        onClose={() => setIsMobileCurriculumOpen(false)}
      />
    </>
  );
}
