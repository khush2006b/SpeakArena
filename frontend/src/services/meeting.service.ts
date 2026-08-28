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
  meetLink?: string;
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

export const normalizeMeeting = (m: any): Meeting => ({
  id: String(m.id),
  courseId: m.courseId || m.course_id || "",
  courseName: m.courseName || m.courseTitle || m.course_title || "Course",
  title: m.title || "",
  description: m.description || "",
  scheduledAt: m.scheduledAt || m.scheduled_at || new Date().toISOString(),
  durationMinutes: Number(m.durationMinutes ?? m.duration_minutes ?? 60),
  meetLink: m.meetLink || m.meet_link || m.meeting_url || "",
  status: String(m.status || "SCHEDULED").toUpperCase() as any,
  createdAt: m.createdAt || m.created_at || new Date().toISOString(),
});

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
      let response: any;
      try {
        response = await apiClient.get<any>(ENDPOINTS.MEETINGS.STUDENT_LIST, { params });
      } catch (err: any) {
        if (err?.response?.status === 401 || err?.response?.status === 403 || err?.response?.status === 404) {
          response = await apiClient.get<any>(ENDPOINTS.MEETINGS.LIST, { params });
        } else {
          throw err;
        }
      }
      const data = response.data;

      const itemsContainer = data?.data?.items ?? data?.items ?? data?.data ?? data;
      const rawItems = Array.isArray(itemsContainer) ? itemsContainer : [];

      const normalizedItems = rawItems.map(normalizeMeeting);
      const total = data?.total ?? data?.data?.total ?? normalizedItems.length;

      return {
        items: normalizedItems,
        total,
        page: pagination?.page ?? 1,
        pageSize: pagination?.pageSize ?? 10,
        totalPages: Math.ceil(total / (pagination?.pageSize ?? 10)) || 1,
        hasNext: (pagination?.page ?? 1) * (pagination?.pageSize ?? 10) < total,
        hasPrev: (pagination?.page ?? 1) > 1,
      };
    } catch {
      return {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      };
    }
  },

  /** GET /teacher/meetings — list teacher meetings */
  teacherList: async (
    pagination?: PaginationConfig,
    filters?: Record<string, unknown>,
  ): Promise<PaginatedResponse<Meeting>> => {
    const params: Record<string, unknown> = {};
    if (pagination?.page) params.page = pagination.page;
    if (pagination?.pageSize) params.page_size = pagination.pageSize;
    if (filters?.courseId) params.course_id = filters.courseId;
    if (filters?.status) params.status = filters.status;

    try {
      const response = await apiClient.get<any>(ENDPOINTS.MEETINGS.LIST, { params });
      const data = response.data;
      const itemsContainer = data?.data?.items ?? data?.items ?? data?.data ?? data;
      const rawItems = Array.isArray(itemsContainer) ? itemsContainer : [];

      const normalizedItems = rawItems.map(normalizeMeeting);
      const total = data?.total ?? data?.data?.total ?? normalizedItems.length;

      return {
        items: normalizedItems,
        total,
        page: pagination?.page ?? 1,
        pageSize: pagination?.pageSize ?? 10,
        totalPages: Math.ceil(total / (pagination?.pageSize ?? 10)) || 1,
        hasNext: (pagination?.page ?? 1) * (pagination?.pageSize ?? 10) < total,
        hasPrev: (pagination?.page ?? 1) > 1,
      };
    } catch {
      return {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
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
    return normalizeMeeting(data.data ?? data);
  },

  /** POST /meetings */
  create: async (payload: CreateMeetingPayload): Promise<Meeting> => {
    const body = {
      course_id: payload.courseId,
      title: payload.title,
      description: payload.description || "",
      meet_link: payload.meetLink && payload.meetLink.trim().length > 0
        ? payload.meetLink.trim()
        : "https://meet.google.com/abc-defg-hij",
      scheduled_at: payload.scheduledAt,
      duration_minutes: payload.durationMinutes,
    };
    const { data } = await apiClient.post<APIResponse<Meeting>>(
      ENDPOINTS.MEETINGS.LIST,
      body,
    );
    return normalizeMeeting(data.data ?? data);
  },

  /** PATCH /meetings/:id */
  update: async (id: string, payload: UpdateMeetingPayload): Promise<Meeting> => {
    const body: Record<string, any> = {};
    if (payload.courseId) body.course_id = payload.courseId;
    if (payload.title) body.title = payload.title;
    if (payload.description !== undefined) body.description = payload.description;
    if (payload.meetLink) body.meet_link = payload.meetLink;
    if (payload.scheduledAt) body.scheduled_at = payload.scheduledAt;
    if (payload.durationMinutes) body.duration_minutes = payload.durationMinutes;
    if (payload.status) body.status = payload.status;

    const { data } = await apiClient.patch<APIResponse<Meeting>>(
      ENDPOINTS.MEETINGS.DETAIL(id),
      body,
    );
    return normalizeMeeting(data.data ?? data);
  },

  /** DELETE /meetings/:id */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(ENDPOINTS.MEETINGS.DETAIL(id));
  },

  /**
   * POST /meetings/:id/join
   * Server validates enrollment before returning the Meet link.
   */
  join: async (id: string): Promise<JoinMeetingResponse> => {
    const res = await apiClient.post<any>(ENDPOINTS.MEETINGS.JOIN(id));
    const rawData = res.data?.data ?? res.data;
    const meetLink =
      rawData?.meetLink ||
      rawData?.meet_link ||
      rawData?.provider_data?.join_url ||
      rawData?.provider_data?.meet_link ||
      rawData?.join_url ||
      "";

    return {
      meetLink,
      isHost: Boolean(rawData?.isHost || rawData?.is_host),
      meeting: rawData?.meeting ? normalizeMeeting(rawData.meeting) : (rawData as any),
      ...rawData,
    };
  },

  /** GET /meetings/:id/attendance */
  getAttendance: async (id: string): Promise<AttendanceRecord[]> => {
    const { data } = await apiClient.get<APIResponse<AttendanceRecord[]>>(
      ENDPOINTS.MEETINGS.ATTENDANCE(id),
    );
    return data.data;
  },
};
