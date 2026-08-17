export const MOCK_WORKSPACE_DATA = {
  course: {
    id: "c-101",
    title: "Advanced Frontend Architecture",
    teacher: "Sarah Chen",
    progress: 65,
    difficulty: "Advanced",
    category: "Engineering",
  },
  currentLesson: {
    id: "l-302",
    title: "Streaming and Suspense",
    moduleId: "m-3",
    description: "Deep dive into React 19 concurrent features. We will explore how to incrementally stream UI components from the server to the client without blocking the main thread, resulting in vastly improved Time to First Byte (TTFB).",
    duration: "45:00",
    videoUrl: "placeholder", // Mocking video
    isCompleted: false,
  },
  curriculum: [
    {
      id: "m-1",
      title: "Module 1: Foundations",
      progress: 100,
      lessons: [
        { id: "l-101", title: "Course Introduction", duration: "05:30", isCompleted: true },
        { id: "l-102", title: "Mental Models of State", duration: "18:45", isCompleted: true },
      ]
    },
    {
      id: "m-2",
      title: "Module 2: Routing Strategies",
      progress: 100,
      lessons: [
        { id: "l-201", title: "File-system Routing vs Programmatic", duration: "22:15", isCompleted: true },
        { id: "l-202", title: "Nested Layouts & Templates", duration: "25:00", isCompleted: true },
      ]
    },
    {
      id: "m-3",
      title: "Module 3: React Server Components",
      progress: 50,
      lessons: [
        { id: "l-301", title: "RSC vs Client Boundaries", duration: "32:10", isCompleted: true },
        { id: "l-302", title: "Streaming and Suspense", duration: "45:00", isCompleted: false }, // Current
        { id: "l-303", title: "Data Fetching Patterns", duration: "38:20", isCompleted: false },
      ]
    },
    {
      id: "m-4",
      title: "Module 4: Performance",
      progress: 0,
      lessons: [
        { id: "l-401", title: "Code Splitting & Dynamic Imports", duration: "20:00", isCompleted: false },
        { id: "l-402", title: "Memoization (useMemo, useCallback)", duration: "28:15", isCompleted: false },
      ]
    }
  ],
  resources: [
    { id: "r-1", title: "React 19 Cheat Sheet", type: "pdf", size: "2.4 MB" },
    { id: "r-2", title: "Suspense Architecture Diagram", type: "image", size: "1.1 MB" },
    { id: "r-3", title: "Source Code Repository", type: "link", size: "External" }
  ],
  notes: [
    { id: "n-1", timestamp: "12:45", content: "Remember that use client does not mean it only runs on the client. It just establishes the boundary." },
    { id: "n-2", timestamp: "34:20", content: "Suspense boundaries should be wrapped as tightly around the async component as possible." }
  ]
};
