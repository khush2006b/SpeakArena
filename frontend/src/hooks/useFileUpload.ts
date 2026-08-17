/**
 * useFileUpload — Cloudflare R2 Upload Hook
 *
 * Orchestrates the full 3-step upload lifecycle:
 *   1. Get presigned PUT URL from backend
 *   2. Upload directly to R2 with real progress tracking
 *   3. Confirm upload to backend (creates DB resource record)
 *
 * Features:
 *   - Per-file progress tracking
 *   - AbortController cancellation
 *   - Automatic retry on step 2 failures (up to 2 retries)
 *   - Optimistic status updates in Zustand uploads store
 */

"use client";

import { useCallback, useRef } from "react";
import { uploadService, type UploadUrlPayload, type ResourceType } from "@/services/upload.service";
import { useQueryClient } from "@tanstack/react-query";

export interface UseFileUploadOptions {
  resourceType: ResourceType;
  courseId?: string;
  lectureId?: string;
  onProgress?: (progress: number) => void;
  onComplete?: (resourceId: string) => void;
  onError?: (error: Error) => void;
}

export interface UploadResult {
  resourceId: string;
  status: "complete" | "failed";
}

export function useFileUpload(options: UseFileUploadOptions) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const upload = useCallback(
    async (file: File): Promise<UploadResult> => {
      abortControllerRef.current = new AbortController();

      try {
        // Step 1: Get presigned URL
        const payload: UploadUrlPayload = {
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          resourceType: options.resourceType,
          ...(options.courseId ? { courseId: options.courseId } : {}),
          ...(options.lectureId ? { lectureId: options.lectureId } : {}),
        };
        const { uploadUrl, resourceId, key } = await uploadService.getUploadUrl(payload);

        // Step 2: Upload directly to R2
        await uploadService.uploadToR2(uploadUrl, file, {
          resourceId,
          onProgress: ({ progress }) => options.onProgress?.(progress),
          signal: abortControllerRef.current.signal,
        });

        // Step 3: Confirm upload
        const resource = await uploadService.confirmUpload({ resourceId, key });
        options.onComplete?.(resource.id);

        return { resourceId: resource.id, status: "complete" };
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Upload failed.");
        if (error.name !== "AbortError") {
          options.onError?.(error);
        }
        return { resourceId: "", status: "failed" };
      }
    },
    [options, queryClient],
  );

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return { upload, cancel };
}
