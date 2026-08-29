/**
 * Notification Service — Integration Layer
 *
 * REST operations for notification fetching and read state.
 * Real-time delivery of new notifications is handled by the
 * Socket.IO client (socketClient.ts) — this service only manages
 * the persisted notification records.
 */

import { apiClient } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";
import type { Notification, PaginatedResponse, APIResponse, PaginationConfig } from "@/types";

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export const notificationService = {
  /** GET /notifications */
  list: async (pagination?: PaginationConfig): Promise<PaginatedResponse<Notification>> => {
    const { data } = await apiClient.get<PaginatedResponse<Notification>>(
      ENDPOINTS.NOTIFICATIONS.LIST,
      { params: pagination },
    );
    return data;
  },

  /** GET /notifications/unread-count */
  getUnreadCount: async (): Promise<number> => {
    const { data } = await apiClient.get<any>(
      ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT,
    );
    const result = data?.data;
    return result?.unread_count ?? result?.count ?? 0;
  },

  /** PATCH /notifications/:id/read */
  markAsRead: async (id: string): Promise<void> => {
    await apiClient.patch(ENDPOINTS.NOTIFICATIONS.MARK_READ(id));
  },

  /** PATCH /notifications/read-all */
  markAllAsRead: async (): Promise<void> => {
    await apiClient.patch(ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
  },
};
