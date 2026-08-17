import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type MeetingStatus = "Scheduled" | "Live" | "Completed" | "Cancelled" | "Draft";

export interface Meeting {
  id: string;
  title: string;
  courseId: string;
  courseName: string;
  start: Date;
  end: Date;
  status: MeetingStatus;
  meetLink?: string;
  isRecurring: boolean;
  attendance?: {
    present: number;
    absent: number;
    late: number;
    total: number;
  };
}

export interface MeetingState {
  calendarView: "month" | "week" | "day" | "agenda";
  currentDate: Date;
  activeMeeting: Meeting | null;
  isCreateModalOpen: boolean;
  
  setCalendarView: (view: "month" | "week" | "day" | "agenda") => void;
  setCurrentDate: (date: Date) => void;
  setActiveMeeting: (meeting: Meeting | null) => void;
  setCreateModalOpen: (isOpen: boolean) => void;
}

export const useMeetingStore = create<MeetingState>()(
  persist(
    (set) => ({
      calendarView: "month",
      currentDate: new Date(),
      activeMeeting: null,
      isCreateModalOpen: false,

      setCalendarView: (view) => set({ calendarView: view }),
      setCurrentDate: (date) => set({ currentDate: date }),
      setActiveMeeting: (meeting) => set({ activeMeeting: meeting }),
      setCreateModalOpen: (isOpen) => set({ isCreateModalOpen: isOpen }),
    }),
    {
      name: "speakarena-meeting-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ calendarView: state.calendarView }),
    }
  )
);
