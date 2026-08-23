/**
 * Default MSW request handlers for all API routes.
 *
 * These handlers provide "happy path" responses for every endpoint
 * the frontend consumes. Individual tests override these defaults
 * using server.use() to test error states, edge cases, etc.
 *
 * Convention: Group handlers by domain. Prefix all URLs with /api/v1/.
 */

import { http, HttpResponse } from "msw";
import {
  makeUser,
  makeCourse,
  makeEnrolledCourse,
  makeNotification,
  makePaymentOrder,
  makeChatMessage,
  makePaginatedResponse,
} from "@/__tests__/factories";

const BASE = "http://localhost:8000/api/v1";

// ---------------------------------------------------------------------------
// Auth handlers
// ---------------------------------------------------------------------------

export const authHandlers = [
  http.post(`${BASE}/auth/login`, () =>
    HttpResponse.json({
      data: {
        accessToken: "mock-access-token-teacher",
        user: makeUser({ role: "teacher" }),
      },
    })
  ),

  http.post(`${BASE}/auth/register`, () =>
    HttpResponse.json(
      { data: { user: makeUser({ role: "student" }) } },
      { status: 201 }
    )
  ),

  http.post(`${BASE}/auth/refresh`, () =>
    HttpResponse.json({ data: { accessToken: "mock-refreshed-token" } })
  ),

  http.post(`${BASE}/auth/logout`, () =>
    HttpResponse.json({ data: { message: "Logged out" } })
  ),

  http.get(`${BASE}/auth/me`, () =>
    HttpResponse.json({ data: { user: makeUser() } })
  ),

  http.post(`${BASE}/auth/forgot-password`, () =>
    HttpResponse.json({ data: { message: "Email sent" } })
  ),

  http.post(`${BASE}/auth/reset-password`, () =>
    HttpResponse.json({ data: { message: "Password reset" } })
  ),
];

// ---------------------------------------------------------------------------
// Notification handlers
// ---------------------------------------------------------------------------

export const notificationHandlers = [
  http.get(`${BASE}/notifications`, () =>
    HttpResponse.json({
      data: makePaginatedResponse([
        makeNotification(),
        makeNotification({ is_read: true }),
        makeNotification(),
      ]),
    })
  ),

  http.get(`${BASE}/notifications/unread-count`, () =>
    HttpResponse.json({ data: { count: 2 } })
  ),

  http.patch(`${BASE}/notifications/:id/read`, () =>
    HttpResponse.json({ data: { message: "Marked as read" } })
  ),

  http.post(`${BASE}/notifications/mark-all-read`, () =>
    HttpResponse.json({ data: { message: "All marked as read" } })
  ),

  http.delete(`${BASE}/notifications/:id`, () =>
    HttpResponse.json({ data: { message: "Deleted" } })
  ),
];

// ---------------------------------------------------------------------------
// Course / Student handlers
// ---------------------------------------------------------------------------

export const courseHandlers = [
  http.get(`${BASE}/courses`, () =>
    HttpResponse.json({
      data: makePaginatedResponse([makeCourse(), makeCourse(), makeCourse()]),
    })
  ),

  http.get(`${BASE}/courses/:id`, ({ params }) =>
    HttpResponse.json({ data: makeCourse({ id: params.id as string }) })
  ),

  http.get(`${BASE}/student/courses`, () =>
    HttpResponse.json({
      data: makePaginatedResponse([
        makeEnrolledCourse({ progress: 45 }),
        makeEnrolledCourse({ progress: 100 }),
      ]),
    })
  ),
];

// ---------------------------------------------------------------------------
// Payment handlers
// ---------------------------------------------------------------------------

export const paymentHandlers = [
  http.post(`${BASE}/payments/checkout`, () =>
    HttpResponse.json({ data: makePaymentOrder() }, { status: 201 })
  ),

  http.post(`${BASE}/payments/verify`, () =>
    HttpResponse.json({ data: { enrolled: true, course_id: "mock-course-id" } })
  ),
];

// ---------------------------------------------------------------------------
// Chat handlers
// ---------------------------------------------------------------------------

export const chatHandlers = [
  http.get(`${BASE}/chat/:courseId/messages`, () =>
    HttpResponse.json({
      data: makePaginatedResponse([
        makeChatMessage(),
        makeChatMessage(),
        makeChatMessage(),
      ]),
    })
  ),
];

// ---------------------------------------------------------------------------
// Video / Upload handlers
// ---------------------------------------------------------------------------

export const uploadHandlers = [
  http.post(`${BASE}/videos/multipart/initiate`, () =>
    HttpResponse.json(
      {
        data: {
          upload_id: "mock-upload-id-123",
          resource_id: "mock-resource-id-456",
        },
      },
      { status: 201 }
    )
  ),

  http.post(`${BASE}/videos/multipart/:uploadId/presign-parts`, () =>
    HttpResponse.json({
      data: {
        presigned_urls: {
          1: "https://r2.example.com/upload?part=1&sig=mock",
          2: "https://r2.example.com/upload?part=2&sig=mock",
          3: "https://r2.example.com/upload?part=3&sig=mock",
        },
      },
    })
  ),

  http.post(`${BASE}/videos/multipart/:uploadId/complete`, () =>
    HttpResponse.json({
      data: { id: "mock-video-id", title: "Test Video", url: "https://r2.example.com/video.mp4" },
    })
  ),

  http.delete(`${BASE}/videos/multipart/:uploadId`, () =>
    HttpResponse.json({ data: { message: "Upload aborted" } })
  ),
];

// ---------------------------------------------------------------------------
// Aggregate all handlers
// ---------------------------------------------------------------------------

export const handlers = [
  ...authHandlers,
  ...notificationHandlers,
  ...courseHandlers,
  ...paymentHandlers,
  ...chatHandlers,
  ...uploadHandlers,
];
