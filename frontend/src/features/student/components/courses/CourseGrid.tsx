"use client";

import * as React from "react";
import { Play, Bookmark, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface CourseGridProps {
  courses: any[];
}

export function CourseGrid({ courses }: CourseGridProps) {
  const router = useRouter();

  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="h-20 w-20 rounded-full flex items-center justify-center bg-card border border-border">
          <BookOpenIcon className="h-10 w-10 opacity-50 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">No courses found</h3>
          <p className="max-w-sm mt-2 text-muted-foreground">Try adjusting your filters or search query to find what you're looking for.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {courses.map((course, idx) => (
        <div 
          key={course.id ? `${course.id}-${idx}` : `student-course-${idx}`} 
          className="group relative flex flex-col overflow-hidden transition-all duration-300 cursor-pointer active:scale-[0.98] card-glass hover-lift"
          style={{ borderRadius: 16 }}
          onClick={() => router.push(`/student/courses/${course.id}`)}
        >
          {/* Thumbnail & Overlays */}
          <div className="relative aspect-video w-full overflow-hidden bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={course.thumbnailUrl || course.thumbnail}
              alt={course.title}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            
            {/* Gradients */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
            
            {/* Quick Actions (Top Right) */}
            <div className="absolute top-3 right-3 flex gap-2 opacity-100 transition-opacity -translate-y-2 group-hover:translate-y-0 duration-300">
              <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 border-none press-scale" onClick={(e) => { e.stopPropagation(); /* Handle bookmark */}}>
                <Bookmark className="h-4 w-4" />
              </Button>
            </div>

            {/* Play Button Overlay (Center) */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100">
              <div className="h-14 w-14 rounded-full flex items-center justify-center shadow-2xl backdrop-blur-sm bg-primary/90 text-primary-foreground">
                <Play className="h-6 w-6 fill-current ml-1" />
              </div>
            </div>

            {/* Bottom Info inside thumbnail */}
            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
              <span className="px-2 py-1 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-semibold text-white border border-white/10 uppercase tracking-wider">
                {course.category}
              </span>
              {course.progress === 100 && (
                <div className="flex items-center gap-1 text-emerald-400 bg-emerald-950/80 backdrop-blur-md px-2 py-1 rounded-md border border-emerald-500/20">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Completed</span>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-5 flex flex-col flex-1">
            <h3 className="font-bold line-clamp-2 leading-tight transition-colors mb-1 text-foreground text-responsive-lg">
              {course.title}
            </h3>
            <p className="text-sm line-clamp-1 mb-4 text-muted-foreground">
              by {course.teacher}
            </p>

            <div className="mt-auto space-y-3">
              {/* Progress */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-foreground">
                  <span>{course.progress}% Complete</span>
                  <span className="text-muted-foreground">{course.completedModules}/{course.totalModules} Modules</span>
                </div>
                <div className="w-full rounded-full h-1.5 overflow-hidden bg-card border-border">
                  <div 
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${course.progress}%`, background: course.progress === 100 ? "hsl(var(--success, 142 71% 45%))" : "hsl(var(--primary))" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BookOpenIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}
