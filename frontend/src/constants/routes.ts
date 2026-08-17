/**
 * Application Routes — Single Source of Truth
 *
 * All navigation paths are defined here. Components and hooks
 * import from ROUTES — never hardcode strings like "/login".
 */

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  FORGOT_PASSWORD: "/forgot-password",

  TEACHER: {
    DASHBOARD: "/teacher",
    COURSES: "/teacher/courses",
    COURSE: (id: string) => `/teacher/courses/${id}`,
    MEETINGS: "/teacher/meetings",
    LIVE: "/teacher/meetings",
    STUDENTS: "/teacher/students",
    ANALYTICS: "/teacher/analytics",
    BILLING: "/teacher/payments",
    PAYMENTS: "/teacher/payments",
    FINANCE: "/teacher/finance",
    CHAT: "/teacher/chat",
    COMMUNICATION: "/teacher/communication",
    RESOURCES: "/teacher/resources",
    MEDIA: "/teacher/media",
    PROFILE: "/teacher/profile",
    SETTINGS: "/teacher/settings",
    NOTIFICATIONS: "/teacher/notifications",
  },

  STUDENT: {
    DASHBOARD: "/student",
    COURSES: "/student/courses",
    COURSE: (id: string) => `/student/courses/${id}`,
    WORKSPACE: (courseId: string, lectureId: string) =>
      `/student/courses/${courseId}/lecture/${lectureId}`,
    MEETINGS: "/student/live",
    LIVE: "/student/live",
    ATTENDANCE: "/student/attendance",
    BILLING: "/student/billing",
    PAYMENTS: "/student/payments",
    PROGRESS: "/student/progress",
    RESUME: "/student/resume",
    MESSAGES: "/student/messages",
    BOOKMARKS: "/student/bookmarks",
    RESOURCES: "/student/resources",
    PROFILE: "/student/profile",
    SETTINGS: "/student/settings",
    NOTIFICATIONS: "/student/notifications",
  },
} as const;
