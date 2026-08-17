import { create } from "zustand";

interface StudentProfileState {
  isEditingProfile: boolean;
  avatarUploadPreview: string | null;
  
  setIsEditingProfile: (isEditing: boolean) => void;
  setAvatarUploadPreview: (url: string | null) => void;
}

export const useStudentProfileStore = create<StudentProfileState>((set) => ({
  isEditingProfile: false,
  avatarUploadPreview: null,
  
  setIsEditingProfile: (isEditing) => set({ isEditingProfile: isEditing }),
  setAvatarUploadPreview: (url) => set({ avatarUploadPreview: url }),
}));
