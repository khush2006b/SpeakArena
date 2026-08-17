import { create } from "zustand";

export interface ProfileState {
  isPreviewMode: boolean;
  completionPercentage: number;
  
  togglePreviewMode: () => void;
  setCompletionPercentage: (percentage: number) => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  isPreviewMode: false,
  completionPercentage: 85, // Mock initial state
  
  togglePreviewMode: () => set((state) => ({ isPreviewMode: !state.isPreviewMode })),
  setCompletionPercentage: (percentage) => set({ completionPercentage: percentage }),
}));
