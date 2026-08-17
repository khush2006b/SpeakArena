/**
 * File upload queue Zustand store.
 *
 * Manages the global upload queue visible to the user via the
 * persistent upload tray (bottom-right corner).
 *
 * Each upload goes through these status transitions:
 *   PENDING → UPLOADING → PROCESSING → COMPLETE
 *                      ↘ FAILED (retryable)
 */

import { create } from "zustand";
import { UploadStatus, type UploadItem } from "@/types";

interface UploadsState {
  queue: UploadItem[];
  isTrayOpen: boolean;
}

interface UploadsActions {
  enqueue: (item: Omit<UploadItem, "progress" | "status" | "error" | "resourceId">) => void;
  updateProgress: (id: string, progress: number) => void;
  setStatus: (id: string, status: UploadStatus) => void;
  markComplete: (id: string, resourceId: string) => void;
  markFailed: (id: string, error: string) => void;
  retry: (id: string) => void;
  remove: (id: string) => void;
  clearCompleted: () => void;
  openTray: () => void;
  closeTray: () => void;
  toggleTray: () => void;
}

type UploadsStore = UploadsState & UploadsActions;

export const useUploadsStore = create<UploadsStore>()((set) => ({
  queue: [],
  isTrayOpen: false,

  enqueue: (item) =>
    set((s) => ({
      queue: [
        ...s.queue,
        {
          ...item,
          progress: 0,
          status: UploadStatus.PENDING,
          error: null,
          resourceId: null,
        },
      ],
      isTrayOpen: true,
    })),

  updateProgress: (id, progress) =>
    set((s) => ({
      queue: s.queue.map((item) =>
        item.id === id
          ? { ...item, progress, status: UploadStatus.UPLOADING }
          : item,
      ),
    })),

  setStatus: (id, status) =>
    set((s) => ({
      queue: s.queue.map((item) =>
        item.id === id ? { ...item, status } : item,
      ),
    })),

  markComplete: (id, resourceId) =>
    set((s) => ({
      queue: s.queue.map((item) =>
        item.id === id
          ? { ...item, progress: 100, status: UploadStatus.COMPLETE, resourceId, error: null }
          : item,
      ),
    })),

  markFailed: (id, error) =>
    set((s) => ({
      queue: s.queue.map((item) =>
        item.id === id
          ? { ...item, status: UploadStatus.FAILED, error }
          : item,
      ),
    })),

  retry: (id) =>
    set((s) => ({
      queue: s.queue.map((item) =>
        item.id === id
          ? { ...item, status: UploadStatus.PENDING, progress: 0, error: null }
          : item,
      ),
    })),

  remove: (id) =>
    set((s) => ({ queue: s.queue.filter((item) => item.id !== id) })),

  clearCompleted: () =>
    set((s) => ({
      queue: s.queue.filter((item) => item.status !== UploadStatus.COMPLETE),
    })),

  openTray: () => set({ isTrayOpen: true }),
  closeTray: () => set({ isTrayOpen: false }),
  toggleTray: () => set((s) => ({ isTrayOpen: !s.isTrayOpen })),
}));
