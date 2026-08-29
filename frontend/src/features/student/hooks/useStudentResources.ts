"use client";
import * as React from 'react';
import { apiClient } from '@/services/api/client';

export interface StudentCourse {
  courseId: string;
  title: string;
  teacherName: string;
  progressPercentage: number;
}

export interface CourseVideo {
  id: string;
  title: string;
  description?: string;
  durationSeconds?: number;
  fileSizeBytes?: number;
  isCompleted: boolean;
  watchPositionSeconds?: number;
  processingStatus?: string;
  createdAt?: string;
}

export interface CoursePDF {
  id: string;
  title: string;
  description?: string;
  fileSizeBytes?: number;
  pageCount?: number;
  isCompleted: boolean;
  isDownloadable?: boolean;
  createdAt?: string;
}

export interface CourseResources {
  course: StudentCourse;
  videos: CourseVideo[];
  pdfs: CoursePDF[];
  isLoading: boolean;
  error: string | null;
}

// Hook to fetch all resources for enrolled courses
export function useStudentResources() {
  const [courseList, setCourseList] = React.useState<StudentCourse[]>([]);
  const [resourcesMap, setResourcesMap] = React.useState<Record<string, { videos: CourseVideo[]; pdfs: CoursePDF[] }>>({});
  const [loadingCourses, setLoadingCourses] = React.useState(true);
  const [loadingResources, setLoadingResources] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    setLoadingCourses(true);
    apiClient.get('/api/v1/courses', { params: { page: 1, page_size: 100 } })
      .then(res => {
        if (!mounted) return;
        const raw = res.data;
        let items: any[] = [];
        if (Array.isArray(raw?.data)) items = raw.data;
        else if (Array.isArray(raw?.data?.items)) items = raw.data.items;
        else if (Array.isArray(raw)) items = raw;
        const courses: StudentCourse[] = items.map((c: any) => ({
          courseId: c.course_id || c.id,
          title: c.title,
          teacherName: c.teacher_name || 'Paras (Construction)',
          progressPercentage: c.progress_percentage ?? 0,
        }));
        setCourseList(courses);
        setError(null);
        // Now fetch resources for each course
        if (courses.length > 0) {
          setLoadingResources(true);
          Promise.allSettled(
            courses.map(course =>
              Promise.all([
                apiClient.get(`/api/v1/videos/${course.courseId}`).then(r => {
                  const d = r.data;
                  // Handle { success, data: [...] } or { success, data: { items: [...] } } or plain array
                  let vids: any[] = [];
                  if (Array.isArray(d?.data?.items)) vids = d.data.items;
                  else if (Array.isArray(d?.data)) vids = d.data;
                  else if (Array.isArray(d?.items)) vids = d.items;
                  else if (Array.isArray(d)) vids = d;
                  return vids;
                }).catch((err) => {
                  console.warn(`[resources] Failed to load videos for course ${course.courseId}:`, err?.response?.data || err?.message);
                  return [];
                }),
                apiClient.get(`/api/v1/pdfs/${course.courseId}`).then(r => {
                  const d = r.data;
                  let pdfs: any[] = [];
                  if (Array.isArray(d?.data?.items)) pdfs = d.data.items;
                  else if (Array.isArray(d?.data)) pdfs = d.data;
                  else if (Array.isArray(d?.items)) pdfs = d.items;
                  else if (Array.isArray(d)) pdfs = d;
                  return pdfs;
                }).catch((err) => {
                  console.warn(`[resources] Failed to load PDFs for course ${course.courseId}:`, err?.response?.data || err?.message);
                  return [];
                }),
              ]).then(([videos, pdfs]) => ({ courseId: course.courseId, videos, pdfs }))
            )
          ).then(results => {
            if (!mounted) return;
            const map: Record<string, { videos: CourseVideo[]; pdfs: CoursePDF[] }> = {};
            results.forEach((result, i) => {
              if (result.status === 'fulfilled') {
                const { courseId, videos, pdfs } = result.value;
                map[courseId] = {
                  videos: videos.map((v: any) => ({
                    id: v.id,
                    title: v.title,
                    description: v.description,
                    durationSeconds: v.duration_seconds,
                    fileSizeBytes: v.file_size_bytes,
                    isCompleted: v.is_completed ?? false,
                    watchPositionSeconds: v.watch_position_seconds ?? 0,
                    processingStatus: v.processing_status,
                    createdAt: v.created_at || v.createdAt,
                  })),
                  pdfs: pdfs.map((p: any) => ({
                    id: p.id,
                    title: p.title,
                    description: p.description,
                    fileSizeBytes: p.file_size_bytes,
                    pageCount: p.page_count,
                    isCompleted: p.is_completed ?? false,
                    isDownloadable: p.is_downloadable,
                    createdAt: p.created_at || p.createdAt,
                  })),
                };
              } else {
                map[courses[i].courseId] = { videos: [], pdfs: [] };
              }
            });
            setResourcesMap(map);
          }).finally(() => {
            if (mounted) setLoadingResources(false);
          });
        }
      })
      .catch(() => {
        if (mounted) setError('Failed to load your enrolled courses.');
      })
      .finally(() => {
        if (mounted) setLoadingCourses(false);
      });

    return () => { mounted = false; };
  }, []);

  return { courseList, resourcesMap, loadingCourses, loadingResources, error };
}
