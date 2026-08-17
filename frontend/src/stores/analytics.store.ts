import { create } from "zustand";

export interface ReportUser {
  id: string;
  name: string;
  avatar: string;
  course: string;
  attendancePercent: number;
  present: number;
  absent: number;
  late: number;
  watchTime: string;
  progressPercent: number;
  riskLevel: "Low" | "Medium" | "High";
}

export interface AnalyticsState {
  dateRange: "today" | "week" | "month" | "year" | "all";
  selectedCourse: string;
  activeReportUser: ReportUser | null;
  
  setDateRange: (range: "today" | "week" | "month" | "year" | "all") => void;
  setSelectedCourse: (courseId: string) => void;
  setActiveReportUser: (user: ReportUser | null) => void;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  dateRange: "month",
  selectedCourse: "all",
  activeReportUser: null,

  setDateRange: (range) => set({ dateRange: range }),
  setSelectedCourse: (courseId) => set({ selectedCourse: courseId }),
  setActiveReportUser: (user) => set({ activeReportUser: user }),
}));
