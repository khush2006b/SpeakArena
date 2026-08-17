import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface MediaItem {
  id: string;
  filename: string;
  type: "video" | "pdf" | "image";
  thumbnail?: string;
  size: number;
  duration?: string;
  pages?: number;
  resolution?: string;
  createdAt: string;
  status: "Ready" | "Processing" | "Failed";
  visibility: "Public" | "Private";
  usageCount: number;
}

export interface UploadTask {
  id: string;
  filename: string;
  progress: number;
  status: "Uploading" | "Processing" | "Ready" | "Failed";
  size: number;
  eta?: string;
}

export interface MediaState {
  viewMode: "grid" | "list" | "gallery";
  activeFile: MediaItem | null;
  uploadQueue: UploadTask[];
  
  setViewMode: (mode: "grid" | "list" | "gallery") => void;
  setActiveFile: (file: MediaItem | null) => void;
  
  // Upload actions
  addUploadTask: (task: UploadTask) => void;
  updateUploadProgress: (id: string, progress: number) => void;
  completeUploadTask: (id: string, resultStatus: "Processing" | "Ready" | "Failed") => void;
  removeUploadTask: (id: string) => void;
}

export const useMediaStore = create<MediaState>()(
  persist(
    (set) => ({
      viewMode: "grid",
      activeFile: null,
      uploadQueue: [],

      setViewMode: (mode) => set({ viewMode: mode }),
      setActiveFile: (file) => set({ activeFile: file }),
      
      addUploadTask: (task) => set((state) => ({ 
        uploadQueue: [task, ...state.uploadQueue] 
      })),
      
      updateUploadProgress: (id, progress) => set((state) => ({
        uploadQueue: state.uploadQueue.map(task => 
          task.id === id ? { ...task, progress } : task
        )
      })),
      
      completeUploadTask: (id, resultStatus) => set((state) => ({
        uploadQueue: state.uploadQueue.map(task => 
          task.id === id ? { ...task, status: resultStatus, progress: 100 } : task
        )
      })),
      
      removeUploadTask: (id) => set((state) => ({
        uploadQueue: state.uploadQueue.filter(task => task.id !== id)
      })),
    }),
    {
      name: "speakarena-media-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ viewMode: state.viewMode }),
    }
  )
);
