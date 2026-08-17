/**
 * Course Query Hooks
 *
 * TanStack Query hooks for all course and lecture operations.
 * These are the only way components interact with course API data.
 */

"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import {
  courseService,
  type CreateCoursePayload,
  type UpdateCoursePayload,
  type UpdateLectureProgressPayload,
} from "@/services/course.service";
import { queryKeys } from "@/lib/queryKeys";
import type { PaginationConfig, FilterConfig } from "@/types";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useCourseList(
  pagination?: PaginationConfig,
  filters?: FilterConfig,
) {
  return useQuery({
    queryKey: queryKeys.courses.list({ ...pagination, ...filters }),
    queryFn: () => courseService.list(pagination, filters),
  });
}

export function useCourseDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.courses.detail(id),
    queryFn: () => courseService.detail(id),
    enabled: !!id,
  });
}

export function useCourseLectures(courseId: string) {
  return useQuery({
    queryKey: queryKeys.courses.lectures(courseId),
    queryFn: () => courseService.getLectures(courseId),
    enabled: !!courseId,
  });
}

export function useLectureDetail(courseId: string, lectureId: string) {
  return useQuery({
    queryKey: queryKeys.courses.lecture(courseId, lectureId),
    queryFn: () => courseService.getLecture(courseId, lectureId),
    enabled: !!courseId && !!lectureId,
  });
}

export function useCourseProgress(courseId: string) {
  return useQuery({
    queryKey: queryKeys.courses.progress(courseId),
    queryFn: () => courseService.getProgress(courseId),
    enabled: !!courseId,
    refetchInterval: 60_000, // Refresh every 60s while the player is open
  });
}

export function useCourseStudents(courseId: string, pagination?: PaginationConfig) {
  return useQuery({
    queryKey: queryKeys.courses.students(courseId),
    queryFn: () => courseService.getStudents(courseId, pagination),
    enabled: !!courseId,
  });
}

// Infinite scroll variant for course catalogs
export function useCourseListInfinite(filters?: FilterConfig) {
  return useInfiniteQuery({
    queryKey: queryKeys.courses.list(filters),
    queryFn: ({ pageParam = 1 }) =>
      courseService.list({ page: pageParam as number, pageSize: 12 }, filters),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasNext ? lastPage.page + 1 : undefined,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCoursePayload) => courseService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all() });
    },
  });
}

export function useUpdateCourse(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateCoursePayload) =>
      courseService.update(id, payload),
    onSuccess: (updated) => {
      // Update the detail cache immediately
      queryClient.setQueryData(queryKeys.courses.detail(id), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all() });
    },
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => courseService.delete(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.courses.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all() });
    },
  });
}

export function useEnrollCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => courseService.enroll(courseId),
    onSuccess: (_, courseId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.progress(courseId) });
    },
  });
}

export function useUpdateLectureProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      lectureId,
      payload,
    }: {
      courseId: string;
      lectureId: string;
      payload: UpdateLectureProgressPayload;
    }) => courseService.updateLectureProgress(courseId, lectureId, payload),
    onMutate: async ({ courseId, lectureId, payload }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.courses.progress(courseId) });

      const previousProgress = queryClient.getQueryData(queryKeys.courses.progress(courseId));

      queryClient.setQueryData(queryKeys.courses.progress(courseId), (old: any) => {
        if (!old) return old;
        
        // Find if this lecture was already completed
        const isAlreadyCompleted = old.completed_lectures?.includes(lectureId);
        
        let newCompletedLectures = [...(old.completed_lectures || [])];
        if (payload.isCompleted && !isAlreadyCompleted) {
          newCompletedLectures.push(lectureId);
        } else if (payload.isCompleted === false && isAlreadyCompleted) {
          newCompletedLectures = newCompletedLectures.filter((id: string) => id !== lectureId);
        }

        // Extremely rough optimistic completion calculation
        const total = old.total_lectures || 1;
        const comp = newCompletedLectures.length;
        const newPercentage = Math.round((comp / total) * 100);

        return {
          ...old,
          completed_lectures: newCompletedLectures,
          completion_percentage: newPercentage,
        };
      });

      return { previousProgress, courseId };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousProgress && context?.courseId) {
        queryClient.setQueryData(
          queryKeys.courses.progress(context.courseId),
          context.previousProgress
        );
      }
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.progress(variables.courseId),
      });
    },
  });
}
