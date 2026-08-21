/**
 * Services Barrel Export
 *
 * Re-exports all service modules. Import from '@/services' in
 * query hooks. Import from specific service files in edge cases
 * where tree-shaking matters.
 */

export { authService } from "./auth.service";
export { courseService } from "./course.service";
export { meetingService } from "./meeting.service";
export { notificationService } from "./notification.service";
export { paymentService } from "./payment.service";
export { uploadService } from "./upload.service";
export { profileService } from "./profile.service";
export { analyticsService } from "./analytics.service";
export { testService } from "./test.service";

// Socket client singletons
export {
  getChatSocket,
  getNotificationSocket,
  connectChatSocket,
  connectNotificationSocket,
  disconnectChatSocket,
  disconnectNotificationSocket,
  sendChatMessage,
  sendTypingStart,
  sendTypingStop,
  socketEvents,
} from "./socket.client";

// API infrastructure
export { apiClient } from "./api/client";
export { ENDPOINTS } from "./api/endpoints";
export {
  setAccessToken,
  getAccessToken,
  withRetry,
} from "./api/interceptors";
