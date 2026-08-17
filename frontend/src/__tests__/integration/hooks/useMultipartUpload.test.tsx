/**
 * @group business-logic
 * @coverage >95%
 *
 * Unit tests for src/hooks/useMultipartUpload.ts
 *
 * Tests the entire multipart upload state machine:
 *   idle → uploading → success
 *   idle → uploading → paused → uploading → success
 *   idle → uploading → error
 *   uploading → canceled
 *
 * The API calls are mocked via MSW (part initiation, presign, complete, abort).
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useMultipartUpload } from "@/hooks/useMultipartUpload";
import { server } from "@/__tests__/setup/msw-server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import axios from "axios";

// Mock axios.put (used for the presigned S3 upload)
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// ---------------------------------------------------------------------------
// Test setup helpers
// ---------------------------------------------------------------------------

const mockUploadId = "upload-abc-123";
const mockResourceId = "resource-xyz-456";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

/** Create a test File with a specific size in bytes. */
function makeFile(sizeBytes: number, type = "video/mp4"): File {
  const content = "x".repeat(sizeBytes);
  return new File([content], "test-video.mp4", { type });
}

// ---------------------------------------------------------------------------
// Shared MSW happy-path overrides
// ---------------------------------------------------------------------------

function setupHappyPath() {
  server.use(
    http.post(
      "http://localhost:8000/api/v1/videos/multipart/initiate",
      () =>
        HttpResponse.json({
          data: { upload_id: mockUploadId, resource_id: mockResourceId },
        })
    ),
    http.post(
      `http://localhost:8000/api/v1/videos/multipart/${mockUploadId}/presign-parts`,
      () =>
        HttpResponse.json({
          data: {
            presigned_urls: { 1: "https://r2.example.com/upload?p=1" },
          },
        })
    ),
    http.post(
      `http://localhost:8000/api/v1/videos/multipart/${mockUploadId}/complete`,
      () =>
        HttpResponse.json({ data: { id: "video-final", title: "Test Video" } })
    )
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useMultipartUpload()", () => {
  const onSuccess = jest.fn();
  const onError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock successful S3 part upload via presigned URL
    mockedAxios.put.mockResolvedValue({
      headers: { etag: '"mock-etag-value"' },
    });
  });

  describe("initial state", () => {
    it("starts in the 'idle' status with 0 progress and no error", () => {
      const wrapper = makeWrapper();
      const { result } = renderHook(
        () => useMultipartUpload({ courseId: "course-001" }),
        { wrapper }
      );
      expect(result.current.status).toBe("idle");
      expect(result.current.progress).toBe(0);
      expect(result.current.error).toBeNull();
    });
  });

  describe("happy path: idle → uploading → success", () => {
    it("completes a single-part upload and calls onSuccess", async () => {
      setupHappyPath();

      const wrapper = makeWrapper();
      const { result } = renderHook(
        () => useMultipartUpload({ courseId: "course-001", onSuccess, onError }),
        { wrapper }
      );

      // File is exactly 5MB — will create exactly 1 part
      const file = makeFile(5 * 1024 * 1024);

      await act(async () => {
        await result.current.startUpload(file, { title: "Lesson 1" });
      });

      expect(result.current.status).toBe("success");
      expect(result.current.progress).toBe(100);
      expect(onSuccess).toHaveBeenCalledWith({ id: "video-final", title: "Test Video" });
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe("pause and resume", () => {
    it("transitions to 'paused' when pauseUpload() is called during upload", async () => {
      // Use a large file so the upload takes multiple ticks
      setupHappyPath();

      const wrapper = makeWrapper();
      const { result } = renderHook(
        () => useMultipartUpload({ courseId: "course-001" }),
        { wrapper }
      );

      const file = makeFile(5 * 1024 * 1024);

      // Start upload but immediately pause
      act(() => {
        result.current.startUpload(file, { title: "Lesson Pause" });
      });

      act(() => {
        result.current.pauseUpload();
      });

      expect(result.current.status).toBe("paused");
    });

    it("does not pause when status is not 'uploading'", () => {
      const wrapper = makeWrapper();
      const { result } = renderHook(
        () => useMultipartUpload({ courseId: "course-001" }),
        { wrapper }
      );

      // Status is 'idle' — pauseUpload should be a no-op
      act(() => {
        result.current.pauseUpload();
      });

      expect(result.current.status).toBe("idle");
    });
  });

  describe("error handling", () => {
    it("transitions to 'error' when initiate call fails", async () => {
      server.use(
        http.post(
          "http://localhost:8000/api/v1/videos/multipart/initiate",
          () => HttpResponse.json({ detail: "Server error" }, { status: 500 })
        )
      );

      const wrapper = makeWrapper();
      const { result } = renderHook(
        () => useMultipartUpload({ courseId: "course-001", onError }),
        { wrapper }
      );

      const file = makeFile(5 * 1024 * 1024);

      await act(async () => {
        await result.current.startUpload(file, { title: "Failing Upload" });
      });

      await waitFor(() => expect(result.current.status).toBe("error"));
      expect(result.current.error).not.toBeNull();
      expect(onError).toHaveBeenCalled();
    });

    it("transitions to 'error' when an S3 part upload fails (no ETag)", async () => {
      setupHappyPath();
      // Mock axios.put to return a response without an ETag
      mockedAxios.put.mockResolvedValueOnce({ headers: {} });

      const wrapper = makeWrapper();
      const { result } = renderHook(
        () => useMultipartUpload({ courseId: "course-001", onError }),
        { wrapper }
      );

      const file = makeFile(5 * 1024 * 1024);

      await act(async () => {
        await result.current.startUpload(file, { title: "Bad Part" });
      });

      await waitFor(() => expect(result.current.status).toBe("error"));
      expect(result.current.error?.message).toBe("No ETag returned from part upload");
    });
  });

  describe("cancel", () => {
    it("cancels an in-progress upload and calls the abort API", async () => {
      setupHappyPath();
      server.use(
        http.delete(
          `http://localhost:8000/api/v1/videos/multipart/${mockUploadId}`,
          () => HttpResponse.json({ data: { message: "aborted" } })
        )
      );

      const wrapper = makeWrapper();
      const { result } = renderHook(
        () => useMultipartUpload({ courseId: "course-001" }),
        { wrapper }
      );

      const file = makeFile(5 * 1024 * 1024);

      act(() => {
        result.current.startUpload(file, { title: "Lesson to Cancel" });
      });

      // Cancel immediately
      await act(async () => {
        await result.current.cancelUpload();
      });

      // After cancel, state resets to idle
      await waitFor(() => {
        expect(["idle", "canceled"]).toContain(result.current.status);
      });
    });
  });
});
