/**
 * Teacher Service — Integration Layer
 *
 * Provides all teacher-specific API operations that span multiple domains:
 *   - Teacher analytics (dashboard KPIs, revenue trends, activity)
 *   - Student management (all students across all courses)
 *   - Revenue / payment reports
 *
 * Domain-specific operations (courses, meetings, notifications, profile)
 * are handled in their own service files.
 */

import { apiClient } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";
import type {
  PaginatedResponse,
  APIResponse,
  PaginationConfig,
} from "@/types";

// ---------------------------------------------------------------------------
// Teacher Analytics & KPI Types
// ---------------------------------------------------------------------------

export interface TeacherKPIs {
  totalRevenue: number;
  revenueChangePercent: number;
  totalStudents: number;
  newStudentsThisMonth: number;
  activeCourses: number;
  draftCourses: number;
  attendanceRate: number;
  attendanceChangePercent: number;
}

export interface RevenueTrend {
  date: string;       // e.g. "Jan", "Feb" or ISO date
  revenue: number;
  students: number;
  target?: number;
}

export interface ActivityItem {
  id: string;
  type: "enrollment" | "meeting" | "payment" | "upload" | "message" | "course";
  title: string;
  description: string;
  timestamp: string;   // ISO 8601
  metadata?: {
    studentName?: string;
    studentAvatar?: string;
    courseName?: string;
    amount?: number;
  };
}

// ---------------------------------------------------------------------------
// Student Management Types (teacher view)
// ---------------------------------------------------------------------------

export interface TeacherStudent {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  country: string | null;
  enrolledCourses: number;
  attendancePercent: number;
  progressPercent: number;
  totalRevenue: number;
  lastActiveAt: string | null;
  joinedAt: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  courseTitle?: string;
  courseId?: string;
  enrollmentId?: string;
  enrollments?: any[];
}

// ---------------------------------------------------------------------------
// Revenue & Finance Types
// ---------------------------------------------------------------------------

export interface TeacherTransaction {
  id: string;
  studentName: string;
  studentEmail: string;
  studentAvatarUrl: string | null;
  courseName: string;
  amount: number;
  currency: string;
  status: "SUCCESS" | "PENDING" | "FAILED" | "REFUNDED";
  createdAt: string;
  invoiceId: string | null;
  last4: string | null;
}

export interface TeacherFinanceSummary {
  totalRevenue: number;
  revenueThisMonth: number;
  pendingPayouts: number;
  refundsThisMonth: number;
  currency: string;
  trends: RevenueTrend[];
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export const teacherService = {
  // --- Dashboard KPIs ---

  /** GET /teacher/dashboard — aggregated dashboard KPIs */
  getKPIs: async (): Promise<TeacherKPIs> => {
    const { data } = await apiClient.get<APIResponse<any>>(
      ENDPOINTS.ANALYTICS.TEACHER,
    );
    const d = data.data ?? {};
    const rev = d.revenue ?? {};
    return {
      totalRevenue: typeof rev === "number" ? rev : (rev.total ?? 0),
      revenueChangePercent: rev.growth_percent ?? 0,
      totalStudents: d.total_students ?? 0,
      newStudentsThisMonth: d.new_students ?? 0,
      activeCourses: d.total_published_courses ?? 0,
      draftCourses: (d.total_courses ?? 0) - (d.total_published_courses ?? 0),
      attendanceRate: d.attendance_rate ?? 95,
      attendanceChangePercent: 2.5,
    };
  },

  /** GET /teacher/analytics/revenue */
  getRevenueTrends: async (period: "week" | "month" | "year" = "month"): Promise<RevenueTrend[]> => {
    try {
      const periodParam = period === "month" ? "MONTHLY" : period.toUpperCase();
      const { data } = await apiClient.get<any>(
        ENDPOINTS.ANALYTICS.REVENUE_TRENDS,
        { params: { period: periodParam } },
      );
      const resData = data?.data;
      if (Array.isArray(resData)) return resData;
      if (Array.isArray(resData?.data_points)) return resData.data_points;
      if (Array.isArray(resData?.data)) return resData.data;
      return [];
    } catch {
      try {
        const { data } = await apiClient.get<any>("/api/v1/teacher/dashboard");
        const raw = data?.data?.revenue_trend || data?.data?.revenue_series;
        return Array.isArray(raw) ? raw : [];
      } catch {
        return [];
      }
    }
  },

  /** GET /teacher/dashboard — recent activity feed */
  getActivity: async (limit = 10): Promise<ActivityItem[]> => {
    try {
      const { data } = await apiClient.get<APIResponse<any>>(
        ENDPOINTS.ANALYTICS.TEACHER,
      );
      const d = data.data ?? {};
      const enrollments = d.recent_enrollments ?? [];
      const payments = d.recent_payments ?? [];
      
      const activity: ActivityItem[] = [
        ...enrollments.map((e: any) => ({
          id: e.id ?? `e-${Math.random()}`,
          type: "enrollment" as const,
          title: "New Student Enrollment",
          description: `${e.student_name ?? "A student"} enrolled in ${e.course_title ?? "a course"}`,
          timestamp: e.created_at ?? new Date().toISOString(),
        })),
        ...payments.map((p: any) => ({
          id: p.id ?? `p-${Math.random()}`,
          type: "payment" as const,
          title: "Payment Received",
          description: `Received ${p.currency ?? "$"}${p.amount ?? 0} for ${p.course_title ?? "course"}`,
          timestamp: p.created_at ?? new Date().toISOString(),
        })),
      ];

      return activity.slice(0, limit);
    } catch {
      return [];
    }
  },

  // --- Student Management ---

  /** GET /students — all students across teacher's courses */
  listStudents: async (
    pagination?: PaginationConfig,
    filters?: {
      search?: string;
      status?: string;
      courseId?: string;
    },
  ): Promise<PaginatedResponse<TeacherStudent>> => {
    const params: Record<string, unknown> = {};
    if (pagination?.page) params.page = pagination.page;
    if (pagination?.pageSize) params.page_size = pagination.pageSize;
    if (filters?.search) params.search = filters.search;
    if (filters?.status) params.status = filters.status;
    if (filters?.courseId) params.course_id = filters.courseId;

    try {
      const { data } = await apiClient.get<any>(
        ENDPOINTS.STUDENTS.LIST,
        { params },
      );
      const rawData = data;
      const rawItems = Array.isArray(rawData?.data)
        ? rawData.data
        : (rawData?.items ?? (Array.isArray(rawData) ? rawData : []));

      // Group/deduplicate enrollments by student_id to show unique students
      const studentMap = new Map<string, TeacherStudent>();

      for (const item of rawItems) {
        const studentId = item.student_id ?? item.id;
        const existing = studentMap.get(studentId);

        const courseTitle = item.course_title ?? "";
        const progress = Number(item.progress_percent ?? item.progress_percentage ?? 0);
        const revenue = Number(item.payment_amount ?? 0);
        const status = (item.enrollment_status ?? item.status ?? "ACTIVE").toUpperCase();

        if (existing) {
          existing.enrolledCourses += 1;
          if (courseTitle && !existing.courseTitle?.includes(courseTitle)) {
            existing.courseTitle = `${existing.courseTitle}, ${courseTitle}`;
          }
          existing.progressPercent = Math.round((existing.progressPercent + progress) / 2);
          existing.totalRevenue += revenue;
          if (status === "SUSPENDED") {
            existing.status = "SUSPENDED";
          }
        } else {
          studentMap.set(studentId, {
            id: studentId,
            fullName: item.student_name ?? item.full_name ?? item.name ?? "Student",
            email: item.student_email ?? item.email ?? "",
            avatarUrl: item.student_avatar_url ?? item.student_avatar_r2_key ?? item.avatar_url ?? null,
            country: item.country ?? "India",
            enrolledCourses: 1,
            attendancePercent: Number(item.attendance_percent ?? 95),
            progressPercent: progress,
            totalRevenue: revenue,
            lastActiveAt: item.last_active_at ?? item.enrolled_at ?? null,
            joinedAt: item.enrolled_at ?? item.created_at ?? new Date().toISOString(),
            status: status as any,
            courseTitle: courseTitle,
            courseId: item.course_id ?? "",
            enrollmentId: item.enrollment_id ?? "",
          });
        }
      }

      const items = Array.from(studentMap.values());
      const total = items.length;

      return {
        items,
        total,
        page: pagination?.page ?? 1,
        pageSize: pagination?.pageSize ?? 20,
        totalPages: Math.ceil(total / (pagination?.pageSize ?? 20)) || 1,
        hasNext: (pagination?.page ?? 1) * (pagination?.pageSize ?? 20) < total,
        hasPrev: (pagination?.page ?? 1) > 1,
      };
    } catch (err) {
      console.error("Failed to list students:", err);
      return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0, hasNext: false, hasPrev: false };
    }
  },

  /** GET /students/:id */
  getStudent: async (id: string): Promise<TeacherStudent> => {
    const { data } = await apiClient.get<any>(
      ENDPOINTS.STUDENTS.DETAIL(id),
    );
    const item = data.data ?? data;
    return {
      id: item.id ?? id,
      fullName: item.full_name ?? item.name ?? "Student",
      email: item.email ?? "",
      avatarUrl: item.avatar_r2_key ?? item.avatar_url ?? null,
      country: item.country ?? "India",
      enrolledCourses: item.enrollments?.length ?? 1,
      attendancePercent: item.attendance_percent ?? 95,
      progressPercent: Number(item.progress_percent ?? 0),
      totalRevenue: Number(item.total_revenue ?? 0),
      lastActiveAt: item.last_active_at ?? null,
      joinedAt: item.created_at ?? new Date().toISOString(),
      status: item.is_active ? "ACTIVE" : "SUSPENDED",
      enrollments: item.enrollments ?? [],
    };
  },

  /** POST /students/:id/suspend */
  suspendStudent: async (studentId: string, courseId?: string, reason?: string) => {
    await apiClient.post(`/api/v1/teacher/students/${studentId}/suspend`, {
      course_id: courseId || undefined,
      reason: reason || "Suspended by teacher",
    });
  },

  /** POST /students/:id/unsuspend */
  unsuspendStudent: async (studentId: string, courseId?: string) => {
    await apiClient.post(`/api/v1/teacher/students/${studentId}/unsuspend`, null, {
      params: courseId ? { course_id: courseId } : {},
    });
  },

  /** POST /students/:id/unenroll */
  unenrollStudent: async (studentId: string, courseId?: string, reason?: string) => {
    const params: Record<string, string> = {};
    if (courseId) params.course_id = courseId;
    if (reason) params.reason = reason;
    await apiClient.post(`/api/v1/teacher/students/${studentId}/unenroll`, null, {
      params,
    });
  },

  /** GET /students/:id/attendance */
  getStudentAttendance: async (studentId: string) => {
    try {
      const { data } = await apiClient.get(`/api/v1/teacher/students/${studentId}/attendance`);
      return data.data ?? data;
    } catch {
      return { items: [] };
    }
  },

  /** POST /students/:id/block */
  blockStudent: async (studentId: string, reason?: string) => {
    await apiClient.post(`/api/v1/teacher/students/${studentId}/block`, {
      reason: reason || "Blocked by teacher",
    });
  },

  /** POST /students/:id/unblock */
  unblockStudent: async (studentId: string) => {
    await apiClient.post(`/api/v1/teacher/students/${studentId}/unblock`);
  },

  // --- Finance ---

  /** GET /teacher/dashboard — list teacher transactions */
  listTransactions: async (
    pagination?: PaginationConfig,
    _filters?: {
      search?: string;
      status?: string;
      courseId?: string;
    },
  ): Promise<PaginatedResponse<TeacherTransaction>> => {
    try {
      const { data } = await apiClient.get<any>("/api/v1/teacher/dashboard");
      const d = data?.data ?? data ?? {};
      const rawItems = d.recent_payments ?? d.transactions ?? [];
      const items: TeacherTransaction[] = rawItems.map((p: any) => ({
        id: p.id ?? p.payment_id ?? `tx-${Math.random()}`,
        studentName: p.student_name ?? p.user_name ?? "Student",
        courseName: p.course_title ?? "Course",
        amount: p.amount ?? 0,
        currency: p.currency ?? "USD",
        status: (p.status?.toUpperCase() ?? "SUCCESS") as any,
        createdAt: p.created_at ?? new Date().toISOString(),
        invoiceId: p.invoice_id ?? null,
        last4: p.last4 ?? null,
        studentEmail: p.student_email ?? "",
        studentAvatarUrl: p.student_avatar_url ?? null
      }));

      return {
        items,
        total: items.length,
        page: pagination?.page ?? 1,
        pageSize: pagination?.pageSize ?? 10,
        totalPages: Math.ceil(items.length / (pagination?.pageSize ?? 10)) || 1,
        hasNext: false,
        hasPrev: false,
      };
    } catch {
      return { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0, hasNext: false, hasPrev: false };
    }
  },

  /** GET /teacher/dashboard — finance overview */
  getFinanceSummary: async (): Promise<TeacherFinanceSummary> => {
    try {
      const { data } = await apiClient.get<any>("/api/v1/teacher/dashboard");
      const d = data?.data ?? data ?? {};
      return {
        totalRevenue: d.total_revenue ?? 0,
        revenueThisMonth: d.monthly_revenue ?? 0,
        pendingPayouts: d.pending_payouts ?? 0,
        refundsThisMonth: 0,
        currency: "USD",
        trends: d.revenue_trend ?? [],
      };
    } catch {
      return {
        totalRevenue: 0,
        revenueThisMonth: 0,
        pendingPayouts: 0,
        refundsThisMonth: 0,
        currency: "USD",
        trends: [],
      };
    }
  },
};
