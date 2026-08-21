/**
 * Global TypeScript type definitions for the SpeakArena frontend.
 *
 * All shared types, enums, and interfaces are exported from this
 * barrel file. Feature-specific types live alongside their features.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum UserRole {
  TEACHER = "TEACHER",
  STUDENT = "STUDENT",
}

export enum CourseStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
}

export enum MeetingStatus {
  SCHEDULED = "SCHEDULED",
  LIVE = "LIVE",
  ENDED = "ENDED",
  CANCELLED = "CANCELLED",
}

export enum UploadStatus {
  PENDING = "PENDING",
  UPLOADING = "UPLOADING",
  PROCESSING = "PROCESSING",
  COMPLETE = "COMPLETE",
  FAILED = "FAILED",
}

export enum NotificationType {
  COURSE = "COURSE",
  MEETING = "MEETING",
  PAYMENT = "PAYMENT",
  CHAT = "CHAT",
  SYSTEM = "SYSTEM",
}

// ---------------------------------------------------------------------------
// API primitives
// ---------------------------------------------------------------------------

export interface APIError {
  status: number;
  code: string;
  message: string;
  detail?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface APIResponse<T> {
  data: T;
  message?: string;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl: string | null;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  tokenType: string;
}

// ---------------------------------------------------------------------------
// Course
// ---------------------------------------------------------------------------

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnailUrl: string | null;
  status: CourseStatus;
  teacherId: string;
  teacherName: string;
  price: number;
  currency: string;
  totalLectures: number;
  totalDurationSeconds: number;
  enrolledCount: number;
  maxStudents?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Enrollment {
  id: string;
  courseId: string;
  studentId: string;
  progressPercent: number;
  lastWatchedAt: string | null;
  completedAt: string | null;
  enrolledAt: string;
}

// ---------------------------------------------------------------------------
// Meeting
// ---------------------------------------------------------------------------

export interface Meeting {
  id: string;
  courseId: string;
  courseTitle?: string;
  courseName?: string;
  title: string;
  description: string | null;
  meetLink: string;
  scheduledAt: string;
  durationMinutes: number;
  status: MeetingStatus;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Notification
// ---------------------------------------------------------------------------

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  resourceId: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  senderAvatarUrl: string | null;
  content: string;
  isPinned: boolean;
  isAnnouncement: boolean;
  replyToId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TypingUser {
  userId: string;
  userName: string;
  roomId: string;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export interface UploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  mimeType: string;
  progress: number;
  status: UploadStatus;
  error: string | null;
  resourceId: string | null;
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export interface Payment {
  id: string;
  studentId: string;
  courseId: string;
  amount: number;
  currency: string;
  status: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface RevenueDataPoint {
  date: string;
  amount: number;
}

export interface TeacherAnalytics {
  totalRevenue: number;
  totalStudents: number;
  totalCourses: number;
  activeStudents: number;
  revenueData: RevenueDataPoint[];
  averageRating: number;
}

// ---------------------------------------------------------------------------
// UI utilities
// ---------------------------------------------------------------------------

export type Theme = "light" | "dark" | "system";

export type SortOrder = "asc" | "desc";

export interface SortConfig {
  field: string;
  order: SortOrder;
}

export interface FilterConfig {
  [key: string]: string | number | boolean | null | undefined;
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
}
