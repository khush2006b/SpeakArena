"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { useParams, useRouter } from "next/navigation";
import { useLectureDetail, useCourseLectures, useUpdateLectureProgress } from "@/hooks/queries/useCourseQueries";

export function WorkspaceBottomNav() {
  const { isFullscreen } = useWorkspaceStore();
  const params = useParams();
  const router = useRouter();
  
  const courseId = params?.courseId as string;
  const lectureId = params?.lectureId as string;

  const { data: lecture } = useLectureDetail(courseId, lectureId);
  const { data: lectures } = useCourseLectures(courseId);
  const updateProgress = useUpdateLectureProgress();

  if (isFullscreen || !lecture || !lectures) return null;

  const currentIndex = lectures.findIndex(l => l.id === lectureId);
  const prevLecture = currentIndex > 0 ? lectures[currentIndex - 1] : null;
  const nextLecture = currentIndex < lectures.length - 1 ? lectures[currentIndex + 1] : null;

  const isCompleted = false; // Progress completion should ideally come from useCourseProgress, assuming false for now unless fetched

  const handleToggleComplete = () => {
    updateProgress.mutate({
      courseId,
      lectureId,
      payload: {
        isCompleted: !isCompleted,
        watchedSeconds: 0
      }
    });
  };

  const goToLecture = (id: string) => {
    router.push(`/student/courses/${courseId}/workspace/${id}`);
  };

  return (
    <div className="h-16 shrink-0 bg-background/95 backdrop-blur-xl border-t border-border/40 flex items-center justify-between px-4 sm:px-6 z-30 transition-all w-full mt-auto">
      
      {/* Previous */}
      <Button 
        variant="ghost" 
        className="text-muted-foreground hover:text-foreground hidden sm:flex"
        disabled={!prevLecture}
        onClick={() => prevLecture && goToLecture(prevLecture.id)}
      >
        <ChevronLeft className="mr-2 h-4 w-4" />
        Previous Lesson
      </Button>
      <Button 
        variant="ghost" 
        size="icon" 
        className="text-muted-foreground sm:hidden"
        disabled={!prevLecture}
        onClick={() => prevLecture && goToLecture(prevLecture.id)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Main Action */}
      <Button 
        onClick={handleToggleComplete}
        disabled={updateProgress.isPending}
        variant={isCompleted ? "outline" : "default"}
        className={`shadow-md hover:scale-105 active:scale-95 transition-all ${
          isCompleted ? "border-emerald-500/50 text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20" : "bg-primary text-primary-foreground"
        }`}
      >
        <CheckCircle2 className="mr-2 h-4 w-4" />
        {isCompleted ? "Completed" : "Mark as Complete"}
      </Button>

      {/* Next */}
      <Button 
        variant="ghost" 
        className="text-muted-foreground hover:text-foreground hidden sm:flex"
        disabled={!nextLecture}
        onClick={() => nextLecture && goToLecture(nextLecture.id)}
      >
        Next Lesson
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
      <Button 
        variant="ghost" 
        size="icon" 
        className="text-muted-foreground sm:hidden"
        disabled={!nextLecture}
        onClick={() => nextLecture && goToLecture(nextLecture.id)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      
    </div>
  );
}
