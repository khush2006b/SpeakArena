"use client";

import * as React from "react";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { useCourseDetail, useCourseProgress } from "@/hooks/queries/useCourseQueries";
import { Skeleton } from "@/components/ui/skeleton";

export function CurriculumHeader() {
  const params = useParams();
  const courseId = params?.courseId as string;
  
  const { toggleLeftSidebar } = useWorkspaceStore();
  
  const { data: course, isLoading: isLoadingCourse } = useCourseDetail(courseId);
  const { data: progress } = useCourseProgress(courseId);

  const progressPercent = progress?.progressPercent ?? 0;

  return (
    <div className="flex flex-col shrink-0 border-b border-border/40 bg-background/95 backdrop-blur-xl relative z-10">
      
      {/* Top Nav (Mobile friendly close) */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border/20">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 hidden md:flex">
          <Link href="/student/courses">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <span className="font-semibold text-sm truncate md:hidden">Curriculum</span>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground md:hidden" onClick={toggleLeftSidebar}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Course Info */}
      <div className="p-4 flex flex-col gap-4">
        {isLoadingCourse ? (
          <Skeleton className="h-20 w-full rounded-md" />
        ) : course ? (
          <div className="flex items-start gap-4">
            <div className="relative h-16 w-24 shrink-0 rounded-md overflow-hidden bg-secondary border border-border/50">
              {course.thumbnailUrl ? (
                <Image src={course.thumbnailUrl} alt={course.title} fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/10">
                  <span className="font-bold text-primary">{course.title[0]}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <h2 className="font-bold text-foreground text-sm leading-tight line-clamp-2 mb-1">{course.title}</h2>
              <p className="text-xs text-muted-foreground">by {course.teacherName}</p>
            </div>
          </div>
        ) : null}

        {/* Global Progress */}
        <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
          <div className="flex justify-between items-center text-xs font-semibold mb-2">
            <span className="text-foreground">Course Progress</span>
            <span className="text-primary">{progressPercent}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden mb-2">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            <span>{progress?.completedLectures ?? 0} / {progress?.totalLectures ?? 0} Lectures</span>
          </div>
        </div>
      </div>
      
    </div>
  );
}
