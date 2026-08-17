"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { ResourcesHeader } from "./ResourcesHeader";
import { CourseResourcesSection } from "./CourseResourcesSection";
import { useStudentResources } from "../../hooks/useStudentResources";

export function ResourcesDashboard() {
  const { courseList, resourcesMap, loadingCourses, loadingResources, error } =
    useStudentResources();
  const [searchQuery, setSearchQuery] = React.useState("");

  // Calculate total resources
  let totalResourcesCount = 0;
  Object.values(resourcesMap).forEach(({ videos, pdfs }) => {
    totalResourcesCount += videos.length + pdfs.length;
  });

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-20 bg-background min-h-screen animate-fade-up">

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
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="card-glass h-[90px] w-full animate-pulse opacity-50"
            />
          ))}
        </div>
      ) : courseList.length === 0 ? (
        <div className="card-glass border-dashed flex flex-col items-center py-16 px-6 text-center">
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
        <div className="flex flex-col">
          {courseList.map((course) => {
            const courseResources = resourcesMap[course.courseId] || {
              videos: [],
              pdfs: [],
            };

            if (loadingResources && !resourcesMap[course.courseId]) {
              return (
                <div
                  key={course.courseId}
                  className="card-glass h-[90px] w-full mb-6 animate-pulse opacity-50"
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
      )}
    </div>
  );
}
