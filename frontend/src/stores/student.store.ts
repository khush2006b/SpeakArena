import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type StudentStatus = "Active" | "Inactive" | "Suspended";

export interface Student {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  country: string;
  enrolledCourses: number;
  attendance: number; // Percentage
  progress: number; // Percentage
  paymentStatus: "Paid" | "Pending" | "Overdue";
  lastActive: string;
  joinedDate: string;
  status: StudentStatus;
  revenue: number;
}

export interface StudentState {
  viewMode: "table" | "card" | "analytics";
  activeStudent: any | null;
  selectedStudents: string[]; // Array of student IDs
  searchQuery: string;
  isAddModalOpen: boolean;
  
  setViewMode: (mode: "table" | "card" | "analytics") => void;
  setActiveStudent: (student: any | null) => void;
  setSearchQuery: (query: string) => void;
  setAddModalOpen: (open: boolean) => void;
  toggleStudentSelection: (id: string) => void;
  selectAllStudents: (ids: string[]) => void;
  clearSelection: () => void;
}

export const useStudentStore = create<StudentState>()(
  persist(
    (set) => ({
      viewMode: "table",
      activeStudent: null,
      selectedStudents: [],
      searchQuery: "",
      isAddModalOpen: false,

      setViewMode: (mode) => set({ viewMode: mode }),
      setActiveStudent: (student) => set({ activeStudent: student }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setAddModalOpen: (isAddModalOpen) => set({ isAddModalOpen }),
      
      toggleStudentSelection: (id) => set((state) => ({
        selectedStudents: state.selectedStudents.includes(id)
          ? state.selectedStudents.filter(sId => sId !== id)
          : [...state.selectedStudents, id]
      })),
      
      selectAllStudents: (ids) => set({ selectedStudents: ids }),
      clearSelection: () => set({ selectedStudents: [] }),
    }),
    {
      name: "speakarena-student-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ viewMode: state.viewMode }),
    }
  )
);
