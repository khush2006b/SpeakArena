"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { User, MessageSquare, Download, Clock, Loader2 } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { Button } from "@/components/ui/button";
import { useCourseDetail, useLectureDetail } from "@/hooks/queries/useCourseQueries";

export function LessonInformation() {
  const params = useParams();
  const courseId = params?.courseId as string;
  const lessonId = params?.lessonId as string;
  
  const { isFullscreen, setActiveRightTab } = useWorkspaceStore();
  
  const { data: course } = useCourseDetail(courseId);
  const { data: lesson, isLoading } = useLectureDetail(courseId, lessonId);

  if (isFullscreen) return null;

  if (isLoading) {
    return (
      <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 flex justify-center py-10">
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!lesson || !course) return null;

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500">
      
      {/* Title & Metadata */}
      <div className="space-y-4 border-b border-border/40 pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {lesson.title}
        </h1>
        
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium">
            <User className="h-4 w-4" />
            <span className="text-foreground/90">{course.teacherName}</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-border" />
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            <span>{Math.floor(lesson.durationSeconds / 60)}m {lesson.durationSeconds % 60}s</span>
          </div>
        </div>
      </div>

      {/* Description */}
      {lesson.description && (
        <div className="py-6">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">About this lesson</h3>
          <p className="text-base text-muted-foreground leading-relaxed max-w-3xl whitespace-pre-wrap">
            {lesson.description}
          </p>
        </div>
      )}

      {/* Quick Action Shortcuts (Mobile/Tablet friendly way to open Right Sidebar) */}
      <div className="flex flex-wrap gap-3 pt-4">
        <Button 
          variant="outline" 
          className="bg-secondary/30 border-border/50 hover:bg-secondary/50 transition-colors"
          onClick={() => setActiveRightTab("discussion")}
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          Ask a Question
        </Button>
        <Button 
          variant="outline" 
          className="bg-secondary/30 border-border/50 hover:bg-secondary/50 transition-colors"
          onClick={() => setActiveRightTab("resources")}
        >
          <Download className="mr-2 h-4 w-4" />
          View Resources
        </Button>
      </div>

    </div>
  );
}
