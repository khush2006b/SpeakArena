/**
 * Meeting Query Hooks
 *
 * TanStack Query hooks for live class operations.
 * The useMeetingJoin hook is the critical path — it gates Google Meet
 * access behind a server-side enrollment check.
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  meetingService,
  type CreateMeetingPayload,
  type UpdateMeetingPayload,
} from "@/services/meeting.service";
import { queryKeys } from "@/lib/queryKeys";
import type { PaginationConfig } from "@/types";

export function useMeetingList(
  pagination?: PaginationConfig,
  filters?: Record<string, unknown>,
) {
  return useQuery({
    queryKey: queryKeys.meetings.list({ ...pagination, ...filters }),
    queryFn: () => meetingService.list(pagination, filters),
    refetchInterval: 30_000, // Poll every 30s to update meeting status (LIVE/ENDED)
  });
}

export function useMeetingDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.meetings.detail(id),
    queryFn: () => meetingService.detail(id),
    enabled: !!id,
    refetchInterval: 15_000, // Refresh frequently to detect status changes
  });
}

export function useMeetingAttendance(id: string) {
  return useQuery({
    queryKey: [...queryKeys.meetings.detail(id), "attendance"],
    queryFn: () => meetingService.getAttendance(id),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMeetingPayload) => meetingService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all() });
    },
  });
}

export function useUpdateMeeting(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateMeetingPayload) =>
      meetingService.update(id, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.meetings.detail(id), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all() });
    },
  });
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => meetingService.delete(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.meetings.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all() });
    },
  });
}

/**
 * useJoinMeeting — critical path for live class access.
 *
 * Calls POST /meetings/:id/join. The backend validates:
 *   1. The student is enrolled in the associated course.
 *   2. The meeting is currently LIVE (or within a grace window).
 *
 * On success, the component receives the Google Meet link to open.
 */
export function useJoinMeeting() {
  return useMutation({
    mutationFn: (id: string) => meetingService.join(id),
    onSuccess: (data: any) => {
      const link =
        data?.meetLink ||
        data?.meet_link ||
        data?.provider_data?.join_url ||
        data?.provider_data?.meet_link ||
        data?.join_url;

      if (link && typeof link === "string" && link.startsWith("http")) {
        window.open(link, "_blank", "noopener,noreferrer");
      } else {
        const { toast } = require("sonner");
        toast.error("Google Meet link not found for this session.");
      }
    },
  });
}
