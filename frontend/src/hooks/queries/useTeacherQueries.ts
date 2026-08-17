/**
 * Teacher Query Hooks — TanStack Query
 *
 * All server-state management for the Teacher Portal.
 * Components import from here — never from services directly.
 *
 * Covers: Dashboard KPIs, Revenue, Activity, Students, Transactions,
 * and teacher-specific course/meeting operations.
 */

"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { teacherService } from "@/services/teacher.service";
import { courseService, type CreateCoursePayload, type UpdateCoursePayload } from "@/services/course.service";
import { meetingService, type CreateMeetingPayload, type UpdateMeetingPayload } from "@/services/meeting.service";
import { profileService, type UpdateProfilePayload } from "@/services/profile.service";
import { notificationService } from "@/services/notification.service";
import { queryKeys } from "@/lib/queryKeys";
import type { PaginationConfig } from "@/types";

// ============================================================
// DASHBOARD
// ============================================================

export function useTeacherKPIs() {
  return useQuery({
    queryKey: queryKeys.analytics.teacher(),
    queryFn: () => teacherService.getKPIs(),
    staleTime: 3 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useRevenueTrends(period: "week" | "month" | "year" = "month") {
  return useQuery({
    queryKey: [...queryKeys.analytics.teacher(), "revenue-trends", period],
    queryFn: () => teacherService.getRevenueTrends(period),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTeacherActivity(limit = 10) {
  return useQuery({
    queryKey: [...queryKeys.analytics.teacher(), "activity", limit],
    queryFn: () => teacherService.getActivity(limit),
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
}

// ============================================================
// COURSES (teacher-owned)
// ============================================================

export function useTeacherCourses(
  pagination?: PaginationConfig,
  filters?: { search?: string; status?: string },
) {
  return useQuery({
    queryKey: queryKeys.courses.list({ ...pagination, ...filters }),
    queryFn: () => courseService.list(pagination, filters),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
  });
}

export function useTeacherCourseDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.courses.detail(id),
    queryFn: () => courseService.detail(id),
    enabled: !!id,
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCoursePayload) => courseService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all() });
    },
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateCoursePayload) =>
      courseService.update(id, payload),
    onMutate: async ({ id, ...patch }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.courses.detail(id) });
      const prev = queryClient.getQueryData(queryKeys.courses.detail(id));
      queryClient.setQueryData(queryKeys.courses.detail(id), (old: unknown) => ({
        ...(old as object),
        ...patch,
      }));
      return { prev };
    },
    onError: (_err, { id }, ctx) => {
      queryClient.setQueryData(queryKeys.courses.detail(id), ctx?.prev);
    },
    onSettled: (_, __, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all() });
    },
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => courseService.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.courses.all() });
      const prev = queryClient.getQueryData(queryKeys.courses.all());
      queryClient.removeQueries({ queryKey: queryKeys.courses.detail(id) });
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.courses.all(), ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all() });
    },
  });
}

// ============================================================
// STUDENTS
// ============================================================

export function useTeacherStudents(
  pagination?: PaginationConfig,
  filters?: { search?: string; status?: string; courseId?: string },
) {
  return useQuery({
    queryKey: queryKeys.students.list({ ...pagination, ...filters }),
    queryFn: () => teacherService.listStudents(pagination, filters),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
  });
}

export function useStudentDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.students.detail(id),
    queryFn: () => teacherService.getStudent(id),
    enabled: !!id,
  });
}

// ============================================================
// MEETINGS
// ============================================================

export function useTeacherMeetings(
  pagination?: PaginationConfig,
  filters?: { status?: string; courseId?: string },
) {
  return useQuery({
    queryKey: queryKeys.meetings.list({ ...pagination, ...filters }),
    queryFn: () => meetingService.list(pagination, filters),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMeetingPayload) => meetingService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all() });
    },
  });
}

export function useUpdateMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & UpdateMeetingPayload) =>
      meetingService.update(id, payload),
    onMutate: async ({ id, ...patch }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.meetings.detail(id) });
      const prev = queryClient.getQueryData(queryKeys.meetings.detail(id));
      queryClient.setQueryData(queryKeys.meetings.detail(id), (old: unknown) => ({
        ...(old as object),
        ...patch,
      }));
      return { prev };
    },
    onError: (_err, { id }, ctx) => {
      queryClient.setQueryData(queryKeys.meetings.detail(id), ctx?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all() });
    },
  });
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => meetingService.delete(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all() });
    },
  });
}

export function useJoinMeeting() {
  return useMutation({
    mutationFn: (id: string) => meetingService.join(id),
    onSuccess: (data) => {
      // Open Google Meet link in new tab
      window.open(data.meetLink, "_blank", "noopener,noreferrer");
    },
  });
}

export function useMeetingAttendance(meetingId: string, enabled = false) {
  return useQuery({
    queryKey: [...queryKeys.meetings.detail(meetingId), "attendance"],
    queryFn: () => meetingService.getAttendance(meetingId),
    enabled: !!meetingId && enabled,
  });
}

// ============================================================
// FINANCE
// ============================================================

export function useTeacherTransactions(
  pagination?: PaginationConfig,
  filters?: { search?: string; status?: string; courseId?: string },
) {
  return useQuery({
    queryKey: queryKeys.payments.list({ ...pagination, ...filters }),
    queryFn: () => teacherService.listTransactions(pagination, filters),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
  });
}

export function useFinanceSummary() {
  return useQuery({
    queryKey: [...queryKeys.payments.all(), "summary"],
    queryFn: () => teacherService.getFinanceSummary(),
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================
// NOTIFICATIONS
// ============================================================

export function useTeacherNotifications(
  pagination?: PaginationConfig,
  filters?: { type?: string; isRead?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.notifications.list({ ...pagination, ...filters }),
    queryFn: () => notificationService.list(pagination),
    placeholderData: keepPreviousData,
    refetchInterval: 60 * 1000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all() });
      // Optimistic: mark as read in every list variant
      queryClient.setQueriesData(
        { queryKey: queryKeys.notifications.all() },
        (old: unknown) => {
          if (!old || typeof old !== "object") return old;
          const data = old as { items: Array<{ id: string; isRead: boolean }> };
          return {
            ...data,
            items: data.items?.map((n) =>
              n.id === id ? { ...n, isRead: true } : n,
            ),
          };
        },
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}

// ============================================================
// PROFILE
// ============================================================

export function useTeacherProfile() {
  return useQuery({
    queryKey: queryKeys.profile.me(),
    queryFn: () => profileService.getMe(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateTeacherProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => profileService.update(payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.profile.me() });
      const prev = queryClient.getQueryData(queryKeys.profile.me());
      queryClient.setQueryData(queryKeys.profile.me(), (old: unknown) => ({
        ...(old as object),
        ...payload,
      }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(queryKeys.profile.me(), ctx?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() });
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
    },
  });
}

export function useUpdateTeacherAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => profileService.updateAvatar(file),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.profile.me(), (old: unknown) => ({
        ...(old as object),
        avatarUrl: data.avatarUrl,
      }));
    },
  });
}
