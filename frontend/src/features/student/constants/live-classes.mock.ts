import { subDays, addDays } from "date-fns";

export type LiveClassStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export interface Teacher {
  name: string;
  avatar: string;
  role: string;
}

export interface LiveClass {
  id: string;
  courseTitle: string;
  topic: string;
  teacher: Teacher;
  startTime: string; // ISO string
  durationMinutes: number;
  status: LiveClassStatus;
  meetLink?: string;
  recordingUrl?: string;
  watchedPercentage?: number;
}

const now = new Date();

export const MOCK_LIVE_CLASSES: LiveClass[] = [
  {
    id: "lc-1",
    courseTitle: "React Architecture",
    topic: "Next.js App Router Deep Dive",
    teacher: {
      name: "Paras (Construction)",
      avatar: "/images/paras_teacher.png",
      role: "Senior Frontend Engineer"
    },
    // Starts in 15 minutes
    startTime: new Date(now.getTime() + 15 * 60000).toISOString(),
    durationMinutes: 90,
    status: "scheduled",
    meetLink: "https://meet.google.com/abc-defg-hij"
  },
  {
    id: "lc-2",
    courseTitle: "Advanced Data Structures",
    topic: "Dynamic Programming Patterns",
    teacher: {
      name: "Alex Johnson",
      avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=Alex",
      role: "Principal Architect"
    },
    // Starts tomorrow
    startTime: addDays(now, 1).toISOString(),
    durationMinutes: 120,
    status: "scheduled",
    meetLink: "https://meet.google.com/xyz-uvw-rst"
  },
  {
    id: "lc-3",
    courseTitle: "React Architecture",
    topic: "Server Actions & Mutations",
    teacher: {
      name: "Paras (Construction)",
      avatar: "/images/paras_teacher.png",
      role: "Senior Frontend Engineer"
    },
    // Started 30 mins ago
    startTime: new Date(now.getTime() - 30 * 60000).toISOString(),
    durationMinutes: 90,
    status: "in_progress",
    meetLink: "https://meet.google.com/123-456-789"
  },
  {
    id: "lc-4",
    courseTitle: "System Design",
    topic: "Scaling Websockets",
    teacher: {
      name: "Michael Chang",
      avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=Michael",
      role: "Backend Lead"
    },
    // Cancelled class
    startTime: addDays(now, 2).toISOString(),
    durationMinutes: 60,
    status: "cancelled"
  },
  {
    id: "lc-5",
    courseTitle: "React Architecture",
    topic: "React 19 Hooks",
    teacher: {
      name: "Paras (Construction)",
      avatar: "/images/paras_teacher.png",
      role: "Senior Frontend Engineer"
    },
    // Past class with recording
    startTime: subDays(now, 2).toISOString(),
    durationMinutes: 60,
    status: "completed",
    recordingUrl: "/student/live/recordings/lc-5",
    watchedPercentage: 100
  },
  {
    id: "lc-6",
    courseTitle: "Advanced Data Structures",
    topic: "Graph Traversal",
    teacher: {
      name: "Alex Johnson",
      avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=Alex",
      role: "Principal Architect"
    },
    // Past class with recording, partially watched
    startTime: subDays(now, 4).toISOString(),
    durationMinutes: 90,
    status: "completed",
    recordingUrl: "/student/live/recordings/lc-6",
    watchedPercentage: 45
  }
];

export const MOCK_ATTENDANCE_SUMMARY = {
  present: 24,
  absent: 2,
  late: 1,
  percentage: 92
};
