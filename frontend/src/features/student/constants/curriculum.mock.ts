export type LessonType = "video" | "pdf" | "live" | "assignment" | "quiz" | "project";
export type LessonStatus = "completed" | "in-progress" | "locked" | "upcoming" | "live-today";

export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  status: LessonStatus;
  duration?: string;
  isBookmarked?: boolean;
  isDownloaded?: boolean;
  meetingTime?: string; // For live classes
  countdown?: string; // For live classes
}

export interface Section {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Module {
  id: string;
  title: string;
  progress: number;
  estimatedDuration: string;
  sections: Section[];
}

export interface CourseCurriculum {
  id: string;
  title: string;
  teacher: string;
  thumbnail: string;
  progress: number; // Overall %
  estimatedRemainingTime: string;
  modules: Module[];
}

export const MOCK_ENTERPRISE_CURRICULUM: CourseCurriculum = {
  id: "c-101",
  title: "Advanced Frontend Architecture",
  teacher: "Sarah Chen",
  thumbnail: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=2070&auto=format&fit=crop",
  progress: 35,
  estimatedRemainingTime: "12h 45m left",
  modules: [
    {
      id: "m-1",
      title: "Module 1: React 19 Foundations",
      progress: 100,
      estimatedDuration: "2h 30m",
      sections: [
        {
          id: "s-1-1",
          title: "Introduction",
          lessons: [
            { id: "l-101", title: "Course Overview", type: "video", status: "completed", duration: "05:30" },
            { id: "l-102", title: "Syllabus & Requirements", type: "pdf", status: "completed", duration: "2 Pages", isDownloaded: true },
          ]
        },
        {
          id: "s-1-2",
          title: "Core Concepts",
          lessons: [
            { id: "l-103", title: "Mental Models of State", type: "video", status: "completed", duration: "18:45", isBookmarked: true },
            { id: "l-104", title: "State Quiz", type: "quiz", status: "completed" },
          ]
        }
      ]
    },
    {
      id: "m-2",
      title: "Module 2: Server Components & Streaming",
      progress: 50,
      estimatedDuration: "4h 15m",
      sections: [
        {
          id: "s-2-1",
          title: "Architecture",
          lessons: [
            { id: "l-201", title: "RSC vs Client Boundaries", type: "video", status: "completed", duration: "32:10" },
            { id: "l-202", title: "Streaming and Suspense", type: "video", status: "in-progress", duration: "45:00", isBookmarked: true },
          ]
        },
        {
          id: "s-2-2",
          title: "Implementation",
          lessons: [
            { id: "l-203", title: "Live Q&A: Suspense", type: "live", status: "live-today", meetingTime: "2:00 PM EST", countdown: "In 45 mins" },
            { id: "l-204", title: "Data Fetching Patterns", type: "video", status: "upcoming", duration: "38:20" },
            { id: "l-205", title: "Architecture Diagram", type: "pdf", status: "upcoming", duration: "1 Page" },
          ]
        }
      ]
    },
    {
      id: "m-3",
      title: "Module 3: Advanced Performance",
      progress: 0,
      estimatedDuration: "5h 00m",
      sections: [
        {
          id: "s-3-1",
          title: "Optimization",
          lessons: [
            { id: "l-301", title: "Code Splitting Strategies", type: "video", status: "locked", duration: "25:00" },
            { id: "l-302", title: "Memoization Deep Dive", type: "video", status: "locked", duration: "42:15" },
          ]
        },
        {
          id: "s-3-2",
          title: "Final Project",
          lessons: [
            { id: "l-303", title: "Build an Optimized Dashboard", type: "project", status: "locked" },
          ]
        }
      ]
    }
  ]
};
