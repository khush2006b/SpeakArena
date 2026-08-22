/**
 * Centralised API endpoint constants.
 *
 * All backend URLs are defined here. Never hardcode paths in
 * service files. This makes API version migrations trivial.
 */

const API_V1 = "/api/v1";

export const ENDPOINTS = {
  // --- Auth ---
  AUTH: {
    LOGIN: `${API_V1}/auth/login`,
    REGISTER: `${API_V1}/auth/register`,
    LOGOUT: `${API_V1}/auth/logout`,
    REFRESH: `${API_V1}/auth/refresh`,
    ME: `${API_V1}/auth/me`,
    VERIFY_EMAIL: `${API_V1}/auth/verify-email`,
    FORGOT_PASSWORD: `${API_V1}/auth/forgot-password`,
    RESET_PASSWORD: `${API_V1}/auth/reset-password`,
  },

  // --- Courses ---
  COURSES: {
    LIST: `${API_V1}/courses`,
    STUDENT_LIST: `${API_V1}/courses`,
    TEACHER_LIST: `${API_V1}/teacher/courses`,
    TEACHER_CREATE: `${API_V1}/teacher/courses`,
    TEACHER_PUBLISH: (id: string) => `${API_V1}/teacher/courses/${id}/publish`,
    DETAIL: (id: string) => `${API_V1}/courses/${id}`,
    TEACHER_DETAIL: (id: string) => `${API_V1}/teacher/courses/${id}`,
    ENROLL: (id: string) => `${API_V1}/courses/${id}/enroll`,
    PROGRESS: (id: string) => `${API_V1}/courses/${id}/progress`,
    LECTURES: (courseId: string) => `${API_V1}/resources/videos?course_id=${courseId}`,
    TEACHER_LECTURES: (courseId: string) => `${API_V1}/teacher/courses/${courseId}/videos`,
    LECTURE: (courseId: string, lectureId: string) => `${API_V1}/courses/${courseId}/lectures/${lectureId}`,
    LECTURE_PROGRESS: (courseId: string, lectureId: string) => `${API_V1}/courses/${courseId}/lectures/${lectureId}/progress`,
    STUDENTS: (courseId: string) => `${API_V1}/teacher/courses/${courseId}/students`,
  },

  // --- Resources ---
  RESOURCES: {
    UPLOAD_URL: `${API_V1}/resources/upload-url`,
    DETAIL: (id: string) => `${API_V1}/resources/${id}`,
    STREAM: (id: string) => `${API_V1}/resources/${id}/stream`,
  },

  // --- Meetings ---
  MEETINGS: {
    LIST: `${API_V1}/teacher/meetings`,
    STUDENT_LIST: `${API_V1}/meetings`,
    DETAIL: (id: string) => `${API_V1}/teacher/meetings/${id}`,
    JOIN: (id: string) => `${API_V1}/live/${id}/join`,
    ATTENDANCE: (id: string) => `${API_V1}/teacher/meetings/${id}/attendance`,
  },

  // --- Chat ---
  CHAT: {
    MESSAGES: (roomId: string) => `${API_V1}/chat/${roomId}/messages`,
    WS: (roomId: string, token: string) =>
      `${(process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:8000").replace("http", "ws")}/ws/chat/${roomId}?token=${token}`,
  },

  // --- Notifications ---
  NOTIFICATIONS: {
    LIST: `${API_V1}/notifications`,
    MARK_READ: (id: string) => `${API_V1}/notifications/${id}/read`,
    MARK_ALL_READ: `${API_V1}/notifications/read-all`,
    UNREAD_COUNT: `${API_V1}/notifications/unread-count`,
  },

  // --- Payments ---
  PAYMENTS: {
    LIST: `${API_V1}/payments/history`,
    HISTORY: `${API_V1}/payments/history`,
    INITIATE: `${API_V1}/payments/create-order`,
    VERIFY: `${API_V1}/payments/verify`,
    DETAIL: (id: string) => `${API_V1}/payments/${id}`,
  },

  // --- Analytics ---
  ANALYTICS: {
    TEACHER: `${API_V1}/teacher/dashboard`,
    REVENUE_TRENDS: `${API_V1}/teacher/analytics/revenue`,
    COURSE: (courseId: string) => `${API_V1}/teacher/courses/${courseId}/analytics`,
  },

  // --- Profile ---
  PROFILE: {
    ME: `${API_V1}/teacher/profile`,
    STUDENT_ME: `${API_V1}/profile`,
    UPDATE: `${API_V1}/teacher/profile`,
    AVATAR: `${API_V1}/teacher/profile/avatar`,
  },

  // --- Students (teacher-only) ---
  STUDENTS: {
    LIST: `${API_V1}/teacher/students`,
    DETAIL: (id: string) => `${API_V1}/teacher/students/${id}`,
    ATTENDANCE: (id: string) => `${API_V1}/teacher/students/${id}/attendance`,
  },
} as const;
