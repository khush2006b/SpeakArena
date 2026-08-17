/**
 * Profile Service — Integration Layer
 */

import { apiClient } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";
import type { User, APIResponse } from "@/types";

export interface UpdateProfilePayload {
  fullName?: string;
  bio?: string;
  country?: string;
  language?: string;
  timezone?: string;
}

export const profileService = {
  /** GET /profile — fetch current user's full profile */
  getMe: async (): Promise<User> => {
    const { data } = await apiClient.get<APIResponse<User>>(ENDPOINTS.PROFILE.ME);
    return data.data;
  },

  /** PATCH /profile */
  update: async (payload: UpdateProfilePayload): Promise<User> => {
    const apiPayload: Record<string, any> = { ...payload };
    if ('fullName' in apiPayload) {
      apiPayload.full_name = apiPayload.fullName;
      delete apiPayload.fullName;
    }

    const { data } = await apiClient.patch<APIResponse<User>>(
      ENDPOINTS.PROFILE.UPDATE,
      apiPayload,
    );
    return data.data;
  },

  /**
   * POST /profile/avatar
   * Sends a multipart/form-data request with the avatar file.
   * The backend uploads to R2 and returns the new avatar URL.
   */
  updateAvatar: async (file: File): Promise<{ avatarUrl: string }> => {
    const formData = new FormData();
    formData.append("avatar", file);
    const { data } = await apiClient.post<APIResponse<{ avatarUrl: string }>>(
      ENDPOINTS.PROFILE.AVATAR,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data.data;
  },
};
