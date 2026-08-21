import { subDays, subHours } from "date-fns";

export type ResourceType = "pdf" | "video" | "slides" | "zip" | "code" | "link";

export interface Resource {
  id: string;
  title: string;
  description: string;
  type: ResourceType;
  course: string;
  module?: string;
  fileSize?: string;
  uploadDate: string; // ISO String
  teacher: string;
  downloads: number;
  isBookmarked: boolean;
  isDownloaded: boolean;
  thumbnailUrl?: string;
  fileUrl?: string;
}

const now = new Date();

export const MOCK_RESOURCES: Resource[] = [
  {
    id: "res-1",
    title: "Next.js App Router Cheat Sheet",
    description: "A comprehensive PDF guide covering all the new Next.js 14/15 App Router conventions, including Server Actions, Layouts, and Data Fetching.",
    type: "pdf",
    course: "React Architecture",
    module: "Next.js Fundamentals",
    fileSize: "2.4 MB",
    uploadDate: subDays(now, 2).toISOString(),
    teacher: "Paras (Construction)",
    downloads: 1205,
    isBookmarked: true,
    isDownloaded: true,
    thumbnailUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=2070&auto=format&fit=crop&blur=50",
    fileUrl: "/downloads/cheat-sheet.pdf"
  },
  {
    id: "res-2",
    title: "Graph Algorithms Boilerplate",
    description: "Starter code in Python and TypeScript for Dijkstra, A*, and Bellman-Ford algorithms.",
    type: "code",
    course: "Advanced Data Structures",
    module: "Graphs & Trees",
    fileSize: "156 KB",
    uploadDate: subDays(now, 5).toISOString(),
    teacher: "Alex Johnson",
    downloads: 843,
    isBookmarked: false,
    isDownloaded: false,
    fileUrl: "https://github.com/speakarena/graphs-boilerplate"
  },
  {
    id: "res-3",
    title: "System Design Prep Deck",
    description: "Presentation slides covering load balancing, caching strategies, and database sharding.",
    type: "slides",
    course: "System Design",
    module: "Scalability Patterns",
    fileSize: "15.8 MB",
    uploadDate: subHours(now, 12).toISOString(),
    teacher: "Michael Chang",
    downloads: 210,
    isBookmarked: true,
    isDownloaded: false,
  },
  {
    id: "res-4",
    title: "Live Class Recording: WebSockets",
    description: "Full recording of the live session building a real-time chat application using Socket.io and Redis.",
    type: "video",
    course: "System Design",
    module: "Real-time Systems",
    fileSize: "450 MB",
    uploadDate: subDays(now, 1).toISOString(),
    teacher: "Michael Chang",
    downloads: 34,
    isBookmarked: false,
    isDownloaded: false,
    thumbnailUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=2070&auto=format&fit=crop&blur=50",
  },
  {
    id: "res-5",
    title: "Starter Project Assets",
    description: "Images, fonts, and mock data JSON files for the final capstone project.",
    type: "zip",
    course: "React Architecture",
    fileSize: "45 MB",
    uploadDate: subDays(now, 10).toISOString(),
    teacher: "Paras (Construction)",
    downloads: 5020,
    isBookmarked: false,
    isDownloaded: true,
  },
  {
    id: "res-6",
    title: "Figma Design System",
    description: "Link to the official SpeakArena UI Kit in Figma Community.",
    type: "link",
    course: "UI/UX Design",
    module: "Design Systems",
    uploadDate: subDays(now, 20).toISOString(),
    teacher: "Emily Rivera",
    downloads: 8900,
    isBookmarked: true,
    isDownloaded: false,
    fileUrl: "https://figma.com/community/..."
  }
];

// Determine "Recently Accessed" by sorting or just hardcoding for mock
export const MOCK_RECENT_RESOURCES = [
  MOCK_RESOURCES[0],
  MOCK_RESOURCES[3],
  MOCK_RESOURCES[2],
];
