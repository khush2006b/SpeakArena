/**
 * Meeting Service — Integration Layer
 *
 * Handles all live class / Google Meet related API operations.
 * The meeting join endpoint validates access server-side before
 * returning the Google Meet link, preventing link sharing abuse.
 */

import { apiClient } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";
import type { Meeting, PaginatedResponse, APIResponse, PaginationConfig } from "@/types";

export interface CreateMeetingPayload {
  courseId: string;
  title: string;
  description?: string;
  scheduledAt: string; // ISO 8601
  durationMinutes: number;
}

export interface UpdateMeetingPayload extends Partial<CreateMeetingPayload> {
  status?: "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";
}

export interface JoinMeetingResponse {
  meetLink: string;
  isHost: boolean;
  meeting: Meeting;
}

export interface AttendanceRecord {
  userId: string;
  userName: string;
  joinedAt: string;
  leftAt: string | null;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export const meetingService = {
  /** GET /meetings — list all meetings */
  list: async (
    pagination?: PaginationConfig,
    filters?: Record<string, unknown>,
  ): Promise<PaginatedResponse<Meeting>> => {
    const params: Record<string, unknown> = {};
    if (pagination?.page) params.page = pagination.page;
    if (pagination?.pageSize) params.page_size = pagination.pageSize;
    if (filters?.courseId) params.course_id = filters.courseId;
    if (filters?.status) {
      if (typeof filters.status === "string" && filters.status.includes(",")) {
        params.upcoming_only = true;
      } else {
        params.status = filters.status;
      }
    }
    if (filters?.upcomingOnly) params.upcoming_only = filters.upcomingOnly;

    try {
      const { data } = await apiClient.get<any>(
        ENDPOINTS.MEETINGS.LIST,
        { params },
      );
      // FastAPI returns paginated envelope or raw list
      if (Array.isArray(data)) {
        return {
          items: data,
          total: data.length,
          page: pagination?.page ?? 1,
          pageSize: pagination?.pageSize ?? 10,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        };
      }
      return data.data ?? data;
    } catch {
      return {
        items: [],
        total: 0,
        page: pagination?.page ?? 1,
        pageSize: pagination?.pageSize ?? 10,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      };
    }
  },

  /** GET /meetings/:id */
  detail: async (id: string): Promise<Meeting> => {
    const { data } = await apiClient.get<APIResponse<Meeting>>(
      ENDPOINTS.MEETINGS.DETAIL(id),
    );
    return data.data;
  },

  /** POST /meetings */
  create: async (payload: CreateMeetingPayload): Promise<Meeting> => {
    const { data } = await apiClient.post<APIResponse<Meeting>>(
      ENDPOINTS.MEETINGS.LIST,
      payload,
    );
    return data.data;
  },

  /** PATCH /meetings/:id */
  update: async (id: string, payload: UpdateMeetingPayload): Promise<Meeting> => {
    const { data } = await apiClient.patch<APIResponse<Meeting>>(
      ENDPOINTS.MEETINGS.DETAIL(id),
      payload,
    );
    return data.data;
  },

  /** DELETE /meetings/:id */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(ENDPOINTS.MEETINGS.DETAIL(id));
  },

  /**
   * POST /meetings/:id/join
   * Server validates enrollment before returning the Meet link.
   * This prevents un-enrolled users from accessing shared links.
   */
  join: async (id: string): Promise<JoinMeetingResponse> => {
    const { data } = await apiClient.post<APIResponse<JoinMeetingResponse>>(
      ENDPOINTS.MEETINGS.JOIN(id),
    );
    return data.data;
  },

  /** GET /meetings/:id/attendance */
  getAttendance: async (id: string): Promise<AttendanceRecord[]> => {
    const { data } = await apiClient.get<APIResponse<AttendanceRecord[]>>(
      ENDPOINTS.MEETINGS.ATTENDANCE(id),
    );
    return data.data;
  },
};
