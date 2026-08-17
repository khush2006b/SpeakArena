import { create } from "zustand";

export type SettingsCategory = 
  | "general" 
  | "profile" 
  | "security" 
  | "notifications" 
  | "teaching" 
  | "courses" 
  | "meetings" 
  | "media" 
  | "payments" 
  | "integrations" 
  | "appearance" 
  | "accessibility" 
  | "advanced" 
  | "danger";

export interface SettingsState {
  activeCategory: SettingsCategory;
  searchQuery: string;
  isSaving: boolean;
  
  setActiveCategory: (category: SettingsCategory) => void;
  setSearchQuery: (query: string) => void;
  setIsSaving: (isSaving: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  activeCategory: "general",
  searchQuery: "",
  isSaving: false,
  
  setActiveCategory: (category) => set({ activeCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setIsSaving: (isSaving) => set({ isSaving }),
}));
