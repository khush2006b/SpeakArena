/**
 * Factory functions for generating realistic test data.
 *
 * Each factory accepts a partial override to allow pinning specific fields
 * while letting everything else default to realistic faker-generated values.
 *
 * Conventions:
 *   - All IDs are deterministic UUIDs by default (overrideable)
 *   - Dates are ISO strings
 *   - Factories compose — makeEnrolledCourse uses makeCourse internally
 *   - No runtime imports from the main app (keep factories lean and fast)
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

let _idCounter = 0;

/** Generate a deterministic UUID-like ID for test stability. */
function uid(prefix = "id"): string {
  return `${prefix}-${(++_idCounter).toString().padStart(6, "0")}`;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isoDate(daysFromNow = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// User / Auth factories
// ---------------------------------------------------------------------------

export interface MockUser {
  id: string;
  email: string;
  full_name: string;
  role: "teacher" | "student";
  is_email_verified: boolean;
  created_at: string;
  avatar_url: string | null;
}

export function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  const role = overrides.role ?? "student";
  return {
    id: uid("user"),
    email: `test.${role}@speakarena.test`,
    full_name: role === "teacher" ? "Prof. Alice Smith" : "Bob Student",
    role,
    is_email_verified: true,
    created_at: isoDate(-30),
    avatar_url: null,
    ...overrides,
  };
}

export interface MockTeacherProfile {
  user_id: string;
  bio: string;
  expertise: string[];
  total_students: number;
  total_courses: number;
}

export function makeTeacherProfile(
  overrides: Partial<MockTeacherProfile> = {}
): MockTeacherProfile {
  return {
    user_id: uid("user"),
    bio: "Experienced educator with 10+ years in software engineering.",
    expertise: ["System Design", "Algorithms", "Backend Development"],
    total_students: randomInt(50, 500),
    total_courses: randomInt(1, 10),
    ...overrides,
  };
}

export interface MockStudentProfile {
  user_id: string;
  enrolled_courses: number;
  completed_courses: number;
  total_watch_time_seconds: number;
}

export function makeStudentProfile(
  overrides: Partial<MockStudentProfile> = {}
): MockStudentProfile {
  return {
    user_id: uid("user"),
    enrolled_courses: randomInt(1, 5),
    completed_courses: randomInt(0, 3),
    total_watch_time_seconds: randomInt(3600, 360000),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Course factories
// ---------------------------------------------------------------------------

export interface MockCourse {
  id: string;
  title: string;
  description: string;
  teacher_id: string;
  price: number; // paise
  currency: string;
  status: "draft" | "published" | "archived";
  thumbnail_url: string | null;
  total_lessons: number;
  total_duration_seconds: number;
  created_at: string;
  updated_at: string;
}

export function makeCourse(overrides: Partial<MockCourse> = {}): MockCourse {
  return {
    id: uid("course"),
    title: "Advanced System Design with FastAPI",
    description: "A comprehensive course on designing scalable backend systems.",
    teacher_id: uid("user"),
    price: 49900, // ₹499
    currency: "INR",
    status: "published",
    thumbnail_url: "https://r2.example.com/thumbnails/thumb-001.webp",
    total_lessons: randomInt(10, 40),
    total_duration_seconds: randomInt(7200, 72000),
    created_at: isoDate(-60),
    updated_at: isoDate(-5),
    ...overrides,
  };
}

export interface MockEnrolledCourse extends MockCourse {
  progress: number; // 0-100
  last_accessed_at: string;
  enrolled_at: string;
}

export function makeEnrolledCourse(
  overrides: Partial<MockEnrolledCourse> = {}
): MockEnrolledCourse {
  return {
    ...makeCourse(),
    progress: randomInt(0, 100),
    last_accessed_at: isoDate(-1),
    enrolled_at: isoDate(-30),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Lesson factories
// ---------------------------------------------------------------------------

export interface MockLesson {
  id: string;
  course_id: string;
  title: string;
  type: "video" | "pdf";
  duration_seconds: number | null;
  order: number;
  is_free_preview: boolean;
}

export function makeLesson(overrides: Partial<MockLesson> = {}): MockLesson {
  return {
    id: uid("lesson"),
    course_id: uid("course"),
    title: "Introduction to Event Sourcing",
    type: "video",
    duration_seconds: randomInt(300, 3600),
    order: randomInt(1, 20),
    is_free_preview: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Meeting factories
// ---------------------------------------------------------------------------

export interface MockMeeting {
  id: string;
  course_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: "scheduled" | "live" | "ended" | "cancelled";
  max_participants: number;
  current_participants: number;
}

export function makeMeeting(overrides: Partial<MockMeeting> = {}): MockMeeting {
  return {
    id: uid("meeting"),
    course_id: uid("course"),
    title: "Live Q&A Session — Week 3",
    scheduled_at: isoDate(1),
    duration_minutes: 60,
    status: "scheduled",
    max_participants: 100,
    current_participants: randomInt(0, 80),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Payment factories
// ---------------------------------------------------------------------------

export interface MockPaymentOrder {
  order_id: string;
  razorpay_order_id: string;
  amount: number;
  currency: string;
  course_id: string;
  key_id: string;
}

export function makePaymentOrder(
  overrides: Partial<MockPaymentOrder> = {}
): MockPaymentOrder {
  return {
    order_id: uid("order"),
    razorpay_order_id: `order_${uid("rzp")}`,
    amount: 49900,
    currency: "INR",
    course_id: uid("course"),
    key_id: "rzp_test_mock_key",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Notification factories
// ---------------------------------------------------------------------------

export interface MockNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  action_url: string | null;
}

export function makeNotification(
  overrides: Partial<MockNotification> = {}
): MockNotification {
  return {
    id: uid("notif"),
    type: "course_enrollment",
    title: "New Student Enrolled",
    body: "Bob Student has enrolled in your course.",
    is_read: false,
    created_at: isoDate(0),
    action_url: "/teacher/students",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Chat / Message factories
// ---------------------------------------------------------------------------

export interface MockChatMessage {
  id: string;
  room_id: string;
  author_id: string;
  content: string;
  content_type: "text";
  created_at: string;
  is_deleted: boolean;
  reply_to_id: string | null;
  reactions: Record<string, string[]>;
}

export function makeChatMessage(
  overrides: Partial<MockChatMessage> = {}
): MockChatMessage {
  return {
    id: uid("msg"),
    room_id: uid("room"),
    author_id: uid("user"),
    content: "Can you explain the CAP theorem again?",
    content_type: "text",
    created_at: isoDate(0),
    is_deleted: false,
    reply_to_id: null,
    reactions: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pagination wrapper
// ---------------------------------------------------------------------------

export interface MockPaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
  has_prev: boolean;
}

export function makePaginatedResponse<T>(
  items: T[],
  overrides: Partial<MockPaginatedResponse<T>> = {}
): MockPaginatedResponse<T> {
  return {
    items,
    total: items.length,
    page: 1,
    page_size: 20,
    has_next: false,
    has_prev: false,
    ...overrides,
  };
}
