"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Maximize, Minimize, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { useCourseDetail, useCourseProgress } from "@/hooks/queries/useCourseQueries";
import { Skeleton } from "@/components/ui/skeleton";

export function WorkspaceHeader() {
  const params = useParams();
  const courseId = params?.courseId as string;
  
  const { 
    isLeftSidebarOpen, 
    toggleLeftSidebar, 
    isRightSidebarOpen, 
    toggleRightSidebar,
    isFullscreen,
    toggleFullscreen
  } = useWorkspaceStore();
  
  const { data: course, isLoading: isLoadingCourse } = useCourseDetail(courseId);
  const { data: progress } = useCourseProgress(courseId);

  const progressPercent = progress?.progressPercent || 0;

  if (isFullscreen) {
    return (
      <div className="absolute top-4 right-4 z-50 opacity-0 hover:opacity-100 transition-opacity">
        <Button variant="secondary" size="icon" className="rounded-full shadow-lg bg-black/50 backdrop-blur-md text-white border-white/10 hover:bg-black/70" onClick={toggleFullscreen}>
          <Minimize className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <header className="h-14 shrink-0 bg-background/95 backdrop-blur-xl border-b border-border/40 flex items-center justify-between px-4 z-30 transition-all">
      
      {/* Left side: Back & Curriculum Toggle */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild className="hidden md:flex h-9 w-9 text-muted-foreground hover:text-foreground shrink-0">
          <Link href="/student/courses">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="w-px h-4 bg-border hidden md:block mx-1" />
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleLeftSidebar}
          className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
        >
          {isLeftSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </Button>
        
        {/* Breadcrumb / Title */}
        <div className="hidden sm:flex flex-col ml-2 overflow-hidden max-w-[200px] md:max-w-md lg:max-w-lg">
          {isLoadingCourse ? (
            <>
              <Skeleton className="h-3 w-20 mb-1" />
              <Skeleton className="h-4 w-40" />
            </>
          ) : course ? (
            <>
              <span className="text-xs font-medium text-muted-foreground line-clamp-1">Course Content</span>
              <span className="text-sm font-semibold text-foreground line-clamp-1">{course.title}</span>
            </>
          ) : null}
        </div>
      </div>

      {/* Right side: Tools & Utility Toggle */}
      <div className="flex items-center gap-2 shrink-0">
        
        {/* Course Progress */}
        <div className="hidden md:flex items-center gap-3 mr-2 bg-secondary/50 rounded-full px-3 py-1 border border-border/50">
          <span className="text-xs font-semibold text-foreground">{progressPercent}%</span>
          <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <ThemeToggle />
        
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" onClick={toggleFullscreen} title="Fullscreen">
          <Maximize className="h-4 w-4" />
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleRightSidebar}
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          {isRightSidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </Button>
      </div>

    </header>
  );
}
