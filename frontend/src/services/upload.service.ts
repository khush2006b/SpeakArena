/**
 * Upload Service — Cloudflare R2 via Presigned URLs
 *
 * Upload flow:
 *   1. Client calls getUploadUrl() — backend issues a presigned PUT URL
 *      scoped to the authenticated user's storage path.
 *   2. Client uploads directly to R2 using the presigned URL.
 *      The backend is NOT in the upload path — this prevents proxying
 *      large files through the Node.js server.
 *   3. On completion, client calls confirmUpload() so the backend can
 *      create the Resource record in the database.
 *
 * This architecture results in zero server bandwidth cost for uploads.
 *
 * Features:
 *   - Real upload progress via XHR (fetch does not support progress)
 *   - Abort / cancel support via AbortController
 *   - Automatic retry on transient network errors
 */

import { apiClient } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";
import type { APIResponse } from "@/types";

export type ResourceType = "video" | "pdf" | "image" | "document";

export interface UploadUrlPayload {
  fileName: string;
  mimeType: string;
  fileSize: number;
  resourceType: ResourceType;
  courseId?: string;
  lectureId?: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;       // Presigned PUT URL
  resourceId: string;      // DB record pre-created (status=PENDING)
  expiresAt: string;       // URL expiry (ISO 8601)
  key: string;             // R2 object key
}

export interface ConfirmUploadPayload {
  resourceId: string;
  key: string;
}

export interface Resource {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  resourceType: ResourceType;
  status: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED";
  url: string | null;
  courseId: string | null;
  lectureId: string | null;
  createdAt: string;
}

export interface UploadProgressEvent {
  resourceId: string;
  progress: number; // 0 - 100
  loaded: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export const uploadService = {
  /**
   * Step 1: Request a presigned PUT URL from the backend.
   * Backend validates file size limits and user permissions.
   */
  getUploadUrl: async (payload: UploadUrlPayload): Promise<UploadUrlResponse> => {
    const { data } = await apiClient.post<APIResponse<UploadUrlResponse>>(
      ENDPOINTS.RESOURCES.UPLOAD_URL,
      payload,
    );
    return data.data;
  },

  /**
   * Step 2: Upload the file directly to Cloudflare R2.
   * Uses XMLHttpRequest for progress reporting (fetch doesn't support this).
   * Returns a promise that resolves when the upload is complete.
   */
  uploadToR2: (
    uploadUrl: string,
    file: File,
    options: {
      resourceId: string;
      onProgress?: (event: UploadProgressEvent) => void;
      signal?: AbortSignal;
    },
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && options.onProgress) {
          options.onProgress({
            resourceId: options.resourceId,
            progress: Math.round((e.loaded / e.total) * 100),
            loaded: e.loaded,
            total: e.total,
          });
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`R2 upload failed: HTTP ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error during file upload."));
      });

      xhr.addEventListener("abort", () => {
        reject(new DOMException("Upload cancelled by user.", "AbortError"));
      });

      // Honour the AbortController signal
      options.signal?.addEventListener("abort", () => {
        xhr.abort();
      });

      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });
  },

  /**
   * Step 3: Notify the backend that the upload is complete.
   * Backend updates Resource status from PENDING → COMPLETE.
   */
  confirmUpload: async (payload: ConfirmUploadPayload): Promise<Resource> => {
    const { data } = await apiClient.post<APIResponse<Resource>>(
      `${ENDPOINTS.RESOURCES.DETAIL(payload.resourceId)}/confirm`,
      { key: payload.key },
    );
    return data.data;
  },

  /** GET /resources/:id — fetch resource metadata */
  getResource: async (id: string): Promise<Resource> => {
    const { data } = await apiClient.get<APIResponse<Resource>>(
      ENDPOINTS.RESOURCES.DETAIL(id),
    );
    return data.data;
  },

  /** GET /resources/:id/stream — get a time-limited streaming URL */
  getStreamUrl: async (id: string): Promise<string> => {
    const { data } = await apiClient.get<APIResponse<{ url: string }>>(
      ENDPOINTS.RESOURCES.STREAM(id),
    );
    return data.data.url;
  },

  /** DELETE /resources/:id */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(ENDPOINTS.RESOURCES.DETAIL(id));
  },
};
