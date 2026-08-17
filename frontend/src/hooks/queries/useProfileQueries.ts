/**
 * Profile & Analytics Query Hooks
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profileService, type UpdateProfilePayload } from "@/services/profile.service";
import { analyticsService } from "@/services/analytics.service";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/stores/auth.store";

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function useProfile() {
  const { isAuthenticated } = useAuthStore();
  return useQuery({
    queryKey: queryKeys.profile.me(),
    queryFn: () => profileService.getMe(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => profileService.update(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.profile.me(), updated);
      queryClient.setQueryData(queryKeys.auth.me(), updated);
    },
  });
}

export function useUpdateAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => profileService.updateAvatar(file),
    onSuccess: () => {
      // Invalidate full profile to pull the new avatar URL
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() });
    },
  });
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export function useTeacherAnalytics() {
  return useQuery({
    queryKey: queryKeys.analytics.teacher(),
    queryFn: () => analyticsService.getTeacherAnalytics(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCourseAnalytics(courseId: string) {
  return useQuery({
    queryKey: queryKeys.analytics.course(courseId),
    queryFn: () => analyticsService.getCourseAnalytics(courseId),
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,
  });
}
