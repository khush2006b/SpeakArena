"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, Layers } from "lucide-react";
import { ResourcesHeader } from "./ResourcesHeader";
import { CourseResourcesSection } from "./CourseResourcesSection";
import { useStudentResources } from "../../hooks/useStudentResources";
import { cn } from "@/lib/utils";

export function ResourcesDashboard() {
  const { courseList, resourcesMap, loadingCourses, loadingResources, error } =
    useStudentResources();
  const [selectedCourseId, setSelectedCourseId] = React.useState<string | "all">("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Calculate total resources
  let totalResourcesCount = 0;
  Object.values(resourcesMap).forEach(({ videos, pdfs }) => {
    totalResourcesCount += videos.length + pdfs.length;
  });

  const filteredCourses = React.useMemo(() => {
    if (selectedCourseId === "all") return courseList;
    return courseList.filter((c) => c.courseId === selectedCourseId);
  }, [courseList, selectedCourseId]);

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-24 bg-background min-h-screen animate-fade-up">

      <ResourcesHeader
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        totalResourcesCount={totalResourcesCount}
      />

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-xl border border-destructive/20 mb-6">
          {error}
        </div>
      )}

      {loadingCourses ? (
        <div className="flex flex-col gap-6">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="card-glass h-[180px] w-full animate-pulse opacity-50 rounded-2xl"
            />
          ))}
        </div>
      ) : courseList.length === 0 ? (
        <div className="card-glass border-dashed flex flex-col items-center py-16 px-6 text-center rounded-2xl">
          <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4 text-muted-foreground">
            <BookOpen size={32} />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            You are not enrolled in any courses yet
          </h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Once you enroll in a course, all your videos, PDFs, and learning
            materials will appear here.
          </p>
          <Link
            href="/student/courses"
            className="btn-primary px-6 py-2.5 rounded-xl font-medium text-sm"
          >
            Browse Courses
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Horizontal Sliding Course Selector Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar touch-pan-x snap-x">
            <button
              onClick={() => setSelectedCourseId("all")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold whitespace-nowrap border transition-all shrink-0 snap-start press-scale",
                selectedCourseId === "all"
                  ? "border-primary/60 bg-primary/15 text-primary ring-1 ring-primary/20 shadow-sm shadow-primary/20"
                  : "border-border/60 bg-card/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
              )}
            >
              <Layers size={15} />
              <span>All Courses</span>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full font-extrabold ml-1",
                selectedCourseId === "all" ? "bg-primary text-white" : "bg-muted/60 text-muted-foreground"
              )}>
                {courseList.length}
              </span>
            </button>

            {courseList.map((course) => {
              const isSelected = selectedCourseId === course.courseId;
              const courseRes = resourcesMap[course.courseId];
              const count = (courseRes?.videos?.length || 0) + (courseRes?.pdfs?.length || 0);

              return (
                <button
                  key={course.courseId}
                  onClick={() => setSelectedCourseId(course.courseId)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap border transition-all shrink-0 snap-start press-scale",
                    isSelected
                      ? "border-primary/60 bg-primary/15 text-primary ring-1 ring-primary/20 shadow-sm shadow-primary/20"
                      : "border-border/60 bg-card/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  <span>{course.title}</span>
                  {count > 0 && (
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-bold ml-1",
                      isSelected ? "bg-primary text-white" : "bg-muted/60 text-muted-foreground"
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Render Course Resource Sections */}
          <div className="space-y-8">
            {filteredCourses.map((course) => {
              const courseResources = resourcesMap[course.courseId] || {
                videos: [],
                pdfs: [],
              };

              if (loadingResources && !resourcesMap[course.courseId]) {
                return (
                  <div
                    key={course.courseId}
                    className="card-glass h-[200px] w-full animate-pulse opacity-50 rounded-2xl"
                  />
                );
              }

              return (
                <CourseResourcesSection
                  key={course.courseId}
                  course={course}
                  videos={courseResources.videos}
                  pdfs={courseResources.pdfs}
                  searchQuery={searchQuery}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
