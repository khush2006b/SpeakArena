/**
 * Integration Architecture — Query Key Factory
 *
 * Centralised, type-safe query key registry for every TanStack Query
 * query and mutation in the application.
 *
 * Pattern: Each entity namespace exports a factory that produces
 * consistent, hierarchical cache keys. This guarantees:
 *   - Predictable cache invalidation (invalidate by root or leaf)
 *   - Zero magic strings scattered across hook files
 *   - IDE autocomplete on every key segment
 *
 * Usage:
 *   useQuery({ queryKey: queryKeys.courses.detail(id), ... })
 *   queryClient.invalidateQueries({ queryKey: queryKeys.courses.all() })
 */

export const queryKeys = {
  // --- Auth ---
  auth: {
    me: () => ["auth", "me"] as const,
  },

  // --- Courses ---
  courses: {
    all: () => ["courses"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["courses", "list", filters] as const,
    detail: (id: string) => ["courses", id] as const,
    lectures: (courseId: string) =>
      ["courses", courseId, "lectures"] as const,
    lecture: (courseId: string, lectureId: string) =>
      ["courses", courseId, "lectures", lectureId] as const,
    progress: (courseId: string) =>
      ["courses", courseId, "progress"] as const,
    students: (courseId: string) =>
      ["courses", courseId, "students"] as const,
  },

  // --- Meetings ---
  meetings: {
    all: () => ["meetings"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["meetings", "list", filters] as const,
    detail: (id: string) => ["meetings", id] as const,
  },

  // --- Notifications ---
  notifications: {
    all: () => ["notifications"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["notifications", "list", filters] as const,
    unreadCount: () => ["notifications", "unread-count"] as const,
  },

  // --- Payments ---
  payments: {
    all: () => ["payments"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["payments", "list", filters] as const,
    detail: (id: string) => ["payments", id] as const,
  },

  // --- Profile ---
  profile: {
    me: () => ["profile", "me"] as const,
  },

  // --- Analytics ---
  analytics: {
    teacher: () => ["analytics", "teacher"] as const,
    course: (courseId: string) => ["analytics", "course", courseId] as const,
  },

  // --- Chat ---
  chat: {
    messages: (roomId: string) => ["chat", roomId, "messages"] as const,
  },

  // --- Students ---
  students: {
    all: () => ["students"] as const,
    list: (filters?: Record<string, unknown>) =>
      ["students", "list", filters] as const,
    detail: (id: string) => ["students", id] as const,
    attendance: (id: string) => ["students", id, "attendance"] as const,
  },
} as const;
