/**
 * Course Service — Integration Layer
 *
 * All API calls related to courses and lectures are centralised here.
 * No mock/fallback data — real DB only.
 */

import { apiClient } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";
import {
  type Course,
  type Enrollment,
  type PaginatedResponse,
  type APIResponse,
  type PaginationConfig,
  type FilterConfig,
  CourseStatus,
} from "@/types";

export interface Lecture {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  position: number;
  durationSeconds: number;
  videoUrl: string | null;
  resourceIds: string[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LectureProgress {
  lectureId: string;
  watchedSeconds: number;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface CourseProgress {
  courseId: string;
  progressPercent: number;
  completedLectures: number;
  totalLectures: number;
  lastWatchedAt: string | null;
  lectureProgress: LectureProgress[];
}

export interface CreateCoursePayload {
  title: string;
  description?: string;
  price?: number;
  currency?: string;
  language?: string;
  visibility?: string;
}

export interface UpdateCoursePayload extends Partial<CreateCoursePayload> {
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  thumbnailUrl?: string | null;
}

export interface UpdateLectureProgressPayload {
  watchedSeconds: number;
  isCompleted?: boolean;
}

/**
 * Maps the backend snake_case course shape to the frontend Course type.
 * Backend returns: id, title, slug, status, price, total_enrollments, total_lectures,
 *                  thumbnail_r2_key, created_at, updated_at, level, language, visibility etc.
 */
function mapCourse(raw: any): Course {
  return {
    id: String(raw.id ?? ""),
    title: raw.title ?? "",
    slug: raw.slug ?? "",
    description: raw.description ?? null,
    thumbnailUrl: raw.thumbnail_url ?? raw.thumbnailUrl ?? null,
    status: (raw.status ?? "DRAFT").toUpperCase() as CourseStatus,
    teacherId: String(raw.teacher_id ?? raw.teacherId ?? ""),
    teacherName: raw.teacher_name ?? raw.teacherName ?? null,
    price: raw.price ?? 0,
    currency: raw.currency ?? "INR",
    totalLectures: raw.total_lectures ?? raw.totalLectures ?? 0,
    totalDurationSeconds: raw.total_duration_seconds ?? raw.totalDurationSeconds ?? 0,
    enrolledCount: raw.total_enrollments ?? raw.enrolledCount ?? 0,
    createdAt: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updated_at ?? raw.updatedAt ?? new Date().toISOString(),
  };
}

/**
 * Maps a paginated API response body to a PaginatedResponse<Course>.
 *
 * Backend paginated_response shape:
 *   { success: true, data: Course[], pagination: { page, page_size, total, total_pages, has_next, has_prev } }
 *
 * (The data field is a direct array, NOT nested under data.items)
 */
function mapPaginatedCourses(raw: any, fallbackPage: number): PaginatedResponse<Course> {
  // raw is the full axios response data (already unwrapped by axios)
  const items: Course[] = Array.isArray(raw?.data)
    ? raw.data.map(mapCourse)
    : Array.isArray(raw?.data?.items)
      ? raw.data.items.map(mapCourse)  // fallback for nested shape
      : Array.isArray(raw?.items)
        ? raw.items.map(mapCourse)
        : [];

  const pagination = raw?.pagination ?? {};
  const total = pagination?.total ?? raw?.total ?? items.length;
  const page = pagination?.page ?? raw?.page ?? fallbackPage;
  const pageSize = pagination?.page_size ?? pagination?.pageSize ?? raw?.page_size ?? 12;
  const totalPages = pagination?.total_pages ?? pagination?.totalPages ?? (Math.ceil(total / pageSize) || 1);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    hasNext: pagination?.has_next ?? page < totalPages,
    hasPrev: pagination?.has_prev ?? page > 1,
  };
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export const courseService = {
  /** GET /teacher/courses — teacher's own courses (paginated, filterable) */
  list: async (
    pagination?: PaginationConfig,
    filters?: FilterConfig,
  ): Promise<PaginatedResponse<Course>> => {
    const params: Record<string, unknown> = {};
    if (pagination?.page) params.page = pagination.page;
    if (pagination?.pageSize) params.page_size = pagination.pageSize;
    if (filters?.search) params.search = filters.search;
    if (filters?.status) params.status = filters.status;

    const { data } = await apiClient.get<any>(ENDPOINTS.COURSES.LIST, { params });
    return mapPaginatedCourses(data, pagination?.page ?? 1);
  },

  /** GET /teacher/courses/:id */
  detail: async (id: string): Promise<Course> => {
    const { data } = await apiClient.get<any>(ENDPOINTS.COURSES.DETAIL(id));
    const raw = data?.data ?? data;
    return mapCourse(raw);
  },

  /** POST /teacher/courses */
  create: async (payload: CreateCoursePayload): Promise<Course> => {
    const { data } = await apiClient.post<any>(ENDPOINTS.COURSES.LIST, {
      title: payload.title,
      description: payload.description,
      price: payload.price ?? 0,
      currency: payload.currency ?? "INR",
      language: payload.language ?? "en",
      visibility: payload.visibility ?? "private",
    });
    const raw = data?.data ?? data;
    return mapCourse(raw);
  },

  /** PATCH /teacher/courses/:id */
  update: async (id: string, payload: UpdateCoursePayload): Promise<Course> => {
    const { data } = await apiClient.patch<any>(ENDPOINTS.COURSES.DETAIL(id), payload);
    const raw = data?.data ?? data;
    return mapCourse(raw);
  },

  /** DELETE /teacher/courses/:id */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(ENDPOINTS.COURSES.DETAIL(id));
  },

  /** POST /courses/:id/enroll */
  enroll: async (courseId: string): Promise<Enrollment> => {
    const { data } = await apiClient.post<APIResponse<Enrollment>>(
      ENDPOINTS.COURSES.ENROLL(courseId),
    );
    return data.data;
  },

  /** GET /teacher/courses/:courseId/videos */
  getLectures: async (courseId: string): Promise<Lecture[]> => {
    const { data } = await apiClient.get<APIResponse<Lecture[]>>(
      ENDPOINTS.COURSES.LECTURES(courseId),
    );
    return data.data;
  },

  /** GET /courses/:courseId/lectures/:lectureId */
  getLecture: async (courseId: string, lectureId: string): Promise<Lecture> => {
    const { data } = await apiClient.get<APIResponse<Lecture>>(
      ENDPOINTS.COURSES.LECTURE(courseId, lectureId),
    );
    return data.data;
  },

  /** GET /courses/:id/progress */
  getProgress: async (courseId: string): Promise<CourseProgress> => {
    const { data } = await apiClient.get<APIResponse<CourseProgress>>(
      ENDPOINTS.COURSES.PROGRESS(courseId),
    );
    return data.data;
  },

  /** PATCH /courses/:courseId/lectures/:lectureId/progress */
  updateLectureProgress: async (
    courseId: string,
    lectureId: string,
    payload: UpdateLectureProgressPayload,
  ): Promise<LectureProgress> => {
    const { data } = await apiClient.patch<APIResponse<LectureProgress>>(
      ENDPOINTS.COURSES.LECTURE_PROGRESS(courseId, lectureId),
      payload,
    );
    return data.data;
  },

  /** GET /teacher/courses/:id/students */
  getStudents: async (
    courseId: string,
    pagination?: PaginationConfig,
  ): Promise<PaginatedResponse<CourseUser>> => {
    const { data } = await apiClient.get<PaginatedResponse<CourseUser>>(
      ENDPOINTS.COURSES.STUDENTS(courseId),
      { params: pagination },
    );
    return data;
  },
};

type CourseUser = {
  id: string;
  email: string;
  fullName: string;
  role: any;
  avatarUrl: string | null;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
};
