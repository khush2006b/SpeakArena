"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { PlayCircle, CheckCircle2, Lock, FileText, Video, PenTool, Radio, Bookmark, DownloadCloud } from "lucide-react";

interface CurriculumLessonProps {
  lesson: any; // Mapped dynamically in CurriculumNavigator
  index: number;
}

export const CurriculumLesson = React.memo(function CurriculumLesson({ lesson, index }: CurriculumLessonProps) {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.courseId as string;
  const activeLessonId = params?.lessonId as string;
  
  const isCurrent = lesson.id === activeLessonId;
  const isLocked = lesson.status === "locked";

  const handleLessonClick = () => {
    if (isLocked) return;
    router.push(`/student/courses/${courseId}/lessons/${lesson.id}`);
  };

  // Determine Icon based on Type
  const getTypeIcon = () => {
    if (lesson.status === "completed") return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />;
    if (lesson.status === "locked") return <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />;
    
    switch (lesson.type) {
      case "video": return <PlayCircle className={`h-4 w-4 shrink-0 mt-0.5 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`} />;
      case "pdf": return <FileText className={`h-4 w-4 shrink-0 mt-0.5 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`} />;
      case "live": return <Video className={`h-4 w-4 shrink-0 mt-0.5 ${isCurrent ? 'text-primary' : 'text-orange-500'}`} />;
      case "quiz": return <Radio className={`h-4 w-4 shrink-0 mt-0.5 ${isCurrent ? 'text-primary' : 'text-purple-500'}`} />;
      case "project": return <PenTool className={`h-4 w-4 shrink-0 mt-0.5 ${isCurrent ? 'text-primary' : 'text-blue-500'}`} />;
      default: return <PlayCircle className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />;
    }
  };

  return (
    <button 
      disabled={isLocked}
      onClick={handleLessonClick}
      className={`w-full flex flex-col items-start gap-1 p-2.5 rounded-md text-left transition-colors group relative overflow-hidden ${
        isCurrent ? "bg-primary/10 hover:bg-primary/15" : 
        isLocked ? "opacity-60 cursor-not-allowed" : 
        "hover:bg-secondary/50"
      }`}
    >
      
      {/* Current Active Indicator (Subtle left border) */}
      {isCurrent && (
        <div className="absolute left-0 top-1 bottom-1 w-1 bg-primary rounded-r-md" />
      )}

      <div className="flex items-start gap-3 w-full pl-1">
        
        {/* Index & Icon */}
        <div className="flex items-center justify-center w-6 shrink-0 mt-0.5">
          <span className="text-[10px] text-muted-foreground font-mono hidden group-hover:hidden">
            {index.toString().padStart(2, '0')}
          </span>
          <div className="block group-hover:block">
            {getTypeIcon()}
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 min-w-0">
          <span className={`text-sm line-clamp-2 leading-snug ${
            isCurrent ? 'font-semibold text-primary' : 
            isLocked ? 'font-medium text-muted-foreground' : 
            'font-medium text-foreground/90'
          }`}>
            {lesson.title}
          </span>
          
          <div className="flex items-center gap-2 mt-1">
            {lesson.duration && (
              <span className="text-[10px] text-muted-foreground font-medium bg-background/50 px-1.5 py-0.5 rounded border border-border/50 shadow-sm">
                {lesson.duration}
              </span>
            )}
            
            {/* Status Badges */}
            {lesson.status === "live-today" && (
              <span className="text-[10px] text-orange-500 font-bold uppercase tracking-wider bg-orange-500/10 px-1.5 py-0.5 rounded animate-pulse border border-orange-500/20">
                Live Today
              </span>
            )}
            {lesson.isBookmarked && (
              <Bookmark className="h-3 w-3 text-primary/70 fill-primary/20" />
            )}
            {lesson.isDownloaded && (
              <DownloadCloud className="h-3 w-3 text-emerald-500/70" />
            )}
          </div>

          {/* Live Meeting Info */}
          {lesson.type === "live" && lesson.meetingTime && (
            <div className="mt-1.5 flex items-center justify-between bg-background border border-border/50 rounded p-1.5 shadow-sm">
              <span className="text-[10px] text-muted-foreground font-medium">{lesson.meetingTime}</span>
              {lesson.countdown && <span className="text-[10px] text-primary font-bold">{lesson.countdown}</span>}
            </div>
          )}

        </div>
      </div>
    </button>
  );
});
