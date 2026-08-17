import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SettingsCategory = 
  | "general" 
  | "learning" 
  | "video" 
  | "reading" 
  | "notifications" 
  | "appearance" 
  | "accessibility" 
  | "privacy" 
  | "security" 
  | "devices" 
  | "danger";

interface StudentSettingsState {
  activeTab: SettingsCategory;
  searchQuery: string;
  
  // Learning
  dailyGoal: number;
  autoResumeLearning: boolean;
  
  // Video
  defaultPlaybackSpeed: string;
  autoplayNext: boolean;
  theaterMode: boolean;
  
  // Accessibility
  reducedMotion: boolean;
  highContrast: boolean;
  largeText: boolean;

  // Actions
  setActiveTab: (tab: SettingsCategory) => void;
  setSearchQuery: (query: string) => void;
  updateSetting: (key: keyof Omit<StudentSettingsState, "activeTab" | "searchQuery" | "setActiveTab" | "setSearchQuery" | "updateSetting">, value: any) => void;
}

export const useStudentSettingsStore = create<StudentSettingsState>()(
  persist(
    (set) => ({
      activeTab: "learning",
      searchQuery: "",
      
      dailyGoal: 60,
      autoResumeLearning: true,
      
      defaultPlaybackSpeed: "1x",
      autoplayNext: true,
      theaterMode: false,
      
      reducedMotion: false,
      highContrast: false,
      largeText: false,
      
      setActiveTab: (tab) => set({ activeTab: tab }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      updateSetting: (key, value) => set((state) => ({ ...state, [key]: value })),
    }),
    {
      name: "speakarena-student-settings",
      partialize: (state) => ({
        dailyGoal: state.dailyGoal,
        autoResumeLearning: state.autoResumeLearning,
        defaultPlaybackSpeed: state.defaultPlaybackSpeed,
        autoplayNext: state.autoplayNext,
        theaterMode: state.theaterMode,
        reducedMotion: state.reducedMotion,
        highContrast: state.highContrast,
        largeText: state.largeText,
      }), // Persist everything except transient UI state (activeTab, searchQuery)
    }
  )
);
