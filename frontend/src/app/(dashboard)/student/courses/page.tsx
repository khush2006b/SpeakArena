"use client";

import * as React from "react";
import { useCoursesStore } from "@/stores/courses.store";
import { CoursesHeader } from "@/features/student/components/courses/CoursesHeader";
import { CourseStatistics } from "@/features/student/components/courses/CourseStatistics";
import { CourseGrid } from "@/features/student/components/courses/CourseGrid";
import { CourseList } from "@/features/student/components/courses/CourseList";
import { CoursePreviewDrawer } from "@/features/student/components/courses/CoursePreviewDrawer";
import { apiClient } from "@/services/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

import { getCourseThumbnailUrl } from "@/lib/utils";

function mapCourse(item: any, idx: number) {
  const resolvedThumbnail = getCourseThumbnailUrl(item, idx);
  return {
    id: item.course_id || item.id || `my-course-${idx}`,
    title: item.title,
    teacher: item.teacher_name || "Paras (Construction)",
    category: item.level || item.category || "Course",
    progress: item.progress_percent ?? item.completion_percentage ?? 0,
    totalModules: item.total_lectures ?? item.totalLectures ?? 0,
    completedModules: item.completed_lectures ?? 0,
    lastWatched: item.last_accessed_at
      ? format(new Date(item.last_accessed_at), "MMM d")
      : item.enrolled_at
      ? format(new Date(item.enrolled_at), "MMM d")
      : "Recently",
    thumbnail: resolvedThumbnail,
    thumbnailUrl: resolvedThumbnail,
    isFavorite: false,
  };
}

export default function MyCoursesPage() {
  const { viewMode, searchQuery } = useCoursesStore();
  const [courses, setCourses] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setIsLoading(true);
    apiClient
      .get("/api/v1/courses", { params: { page: 1, page_size: 100 } })
      .then((res) => {
        const raw = res.data;
        let list: any[] = [];
        if (Array.isArray(raw?.data)) list = raw.data;
        else if (Array.isArray(raw?.data?.items)) list = raw.data.items;
        else if (Array.isArray(raw)) list = raw;
        setCourses(list.map(mapCourse));
        setError(null);
      })
      .catch(() => setError("Failed to load courses."))
      .finally(() => setIsLoading(false));
  }, []);

  const filteredCourses = React.useMemo(() => {
    if (!searchQuery.trim()) return courses;
    const q = searchQuery.toLowerCase();
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.teacher.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
  }, [courses, searchQuery]);

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      <CoursesHeader />
      <section>
        <CourseStatistics />
      </section>
      <section>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-64 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-20" style={{ color: "#ef4444" }}>{error}</div>
        ) : viewMode === "grid" ? (
          <CourseGrid courses={filteredCourses} />
        ) : (
          <CourseList courses={filteredCourses} />
        )}
      </section>
      <CoursePreviewDrawer />
    </div>
  );
}
