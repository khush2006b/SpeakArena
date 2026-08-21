"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Play, X, Clock, FileText, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCoursesStore } from "@/stores/courses.store";
import { useCourseDetail, useCourseProgress } from "@/hooks/queries/useCourseQueries";
import { formatDistanceToNow } from "date-fns";

export function CoursePreviewDrawer() {
  const { selectedCourseId, setSelectedCourseId } = useCoursesStore();
  const router = useRouter();
  
  const { data: course, isLoading: isLoadingCourse } = useCourseDetail(selectedCourseId || "");
  const { data: progressData } = useCourseProgress(selectedCourseId || "");
  
  const progressPercent = progressData?.progressPercent ?? 0;
  const isCompleted = progressPercent === 100;

  return (
    <Sheet open={!!selectedCourseId} onOpenChange={(open) => !open && setSelectedCourseId(null)}>
      <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg p-0 backdrop-blur-xl overflow-y-auto custom-scrollbar border-l-0" style={{ background: "rgba(8,12,20,0.95)", borderLeft: "1px solid rgba(255,255,255,0.07)" }}>
        <SheetTitle className="sr-only">{course?.title || "Course Preview"}</SheetTitle>
        
        {isLoadingCourse ? (
          <div className="flex items-center justify-center h-full w-full">
            <div className="animate-pulse flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#4f46e5" }} />
              <p className="text-sm" style={{ color: "#9ca3af" }}>Loading course...</p>
            </div>
          </div>
        ) : course ? (
          <div className="flex flex-col min-h-full animate-in fade-in slide-in-from-right-4 duration-500">
            
            {/* Hero Image Section */}
            <div className="relative aspect-video w-full" style={{ background: "rgba(255,255,255,0.05)" }}>
              {course.thumbnailUrl ? (
                <Image
                  src={course.thumbnailUrl}
                  alt={course.title}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(79,70,229,0.1)" }}>
                  <span className="text-2xl font-bold" style={{ color: "#4f46e5" }}>{course.title[0]}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#080c14] via-[#080c14]/20 to-transparent" />
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-4 right-4 h-8 w-8 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 z-10"
                onClick={() => setSelectedCourseId(null)}
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="absolute inset-0 flex items-center justify-center">
                <Button size="icon" className="h-16 w-16 rounded-full shadow-2xl backdrop-blur-sm hover:scale-105 transition-transform active:scale-95" style={{ background: "rgba(79,70,229,0.9)", color: "#fff" }}>
                  <Play className="h-6 w-6 fill-current ml-1" />
                </Button>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-8 flex-1">
              
              {/* Header Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#6b7280" }}>
                    Course
                  </span>
                  {isCompleted && (
                    <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981" }}>
                      <CheckCircle2 className="h-3 w-3" /> Completed
                    </span>
                  )}
                </div>
                
                <h2 className="tracking-tight" style={{ color: "#fff", fontWeight: 800, fontSize: "clamp(24px, 2.5vw, 36px)", letterSpacing: "-0.03em" }}>{course.title}</h2>
                <p className="text-sm font-medium" style={{ color: "#818cf8" }}>Taught by {course.teacherName}</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#9ca3af" }}>
                  {course.description}
                </p>
              </div>

              {/* Progress Box */}
              <div className="rounded-xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span style={{ color: "#e5e7eb" }}>Course Progress</span>
                  <span style={{ color: isCompleted ? "#10b981" : "#4f46e5" }}>
                    {progressPercent}%
                  </span>
                </div>
                <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <div 
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${progressPercent}%`, background: isCompleted ? "#10b981" : "#4f46e5" }}
                  />
                </div>
                <div className="flex items-center gap-4 pt-2 text-xs font-medium" style={{ color: "#6b7280" }}>
                  <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> {course.totalLectures} Lectures</span>
                  {progressData?.lastWatchedAt && (
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Last watched {formatDistanceToNow(new Date(progressData.lastWatchedAt))} ago</span>
                  )}
                </div>
              </div>

            </div>

            {/* Sticky Bottom Actions */}
            <div className="p-4 sticky bottom-0 flex gap-3 backdrop-blur-xl bg-card/90 border-t border-border">
              <Button
                className="flex-1 shadow-md hover:scale-105 active:scale-95 transition-all text-base h-11 btn-primary"
                style={{ borderRadius: 10, fontWeight: 700 }}
                onClick={() => {
                  setSelectedCourseId(null);
                  router.push(`/student/courses/${selectedCourseId}`);
                }}
              >
                <Play className="mr-2 h-4 w-4 fill-current" />
                {progressPercent === 0 ? "Start Course" : "Go to Course"}
              </Button>
            </div>

          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
