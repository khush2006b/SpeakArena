/**
 * Analytics Service — Integration Layer
 */

import { apiClient } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";
import type { TeacherAnalytics, APIResponse } from "@/types";

export interface CourseAnalytics {
  courseId: string;
  totalStudents: number;
  completionRate: number;
  averageProgress: number;
  totalRevenue: number;
  lectureCompletions: Array<{
    lectureId: string;
    lectureTitle: string;
    completedCount: number;
  }>;
}

export const analyticsService = {
  /** GET /analytics/teacher */
  getTeacherAnalytics: async (): Promise<TeacherAnalytics> => {
    const { data } = await apiClient.get<APIResponse<TeacherAnalytics>>(
      ENDPOINTS.ANALYTICS.TEACHER,
    );
    return data.data;
  },

  /** GET /analytics/courses/:courseId */
  getCourseAnalytics: async (courseId: string): Promise<CourseAnalytics> => {
    const { data } = await apiClient.get<APIResponse<CourseAnalytics>>(
      ENDPOINTS.ANALYTICS.COURSE(courseId),
    );
    return data.data;
  },
};
