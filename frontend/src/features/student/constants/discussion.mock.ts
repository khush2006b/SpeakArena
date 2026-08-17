export type DiscussionType = "question" | "discussion" | "announcement" | "resource" | "live";
export type DiscussionFilter = "all" | "unanswered" | "solved" | "pinned" | "teacher" | "my_questions";
export type DiscussionCategory = "qna" | "announcements" | "general" | "live_class";

export interface Author {
  id: string;
  name: string;
  avatar: string;
  role: "student" | "teacher" | "ta";
  isVerifiedTeacher?: boolean;
}

export interface Reply {
  id: string;
  author: Author;
  content: string; // HTML from Tiptap
  createdAt: string;
  likes: number;
  isAcceptedAnswer?: boolean;
  replies?: Reply[]; // Nested replies
}

export interface DiscussionThread {
  id: string;
  title: string;
  type: DiscussionType;
  author: Author;
  content: string; // HTML from Tiptap
  createdAt: string;
  tags: string[];
  views: number;
  isSolved: boolean;
  isPinned: boolean;
  isLocked: boolean;
  replies: Reply[];
  
  // Context
  relatedLessonId?: string;
  relatedLessonTitle?: string;
}

export const MOCK_DISCUSSION_THREADS: DiscussionThread[] = [
  {
    id: "dt-1",
    title: "How do React Server Components handle state?",
    type: "question",
    author: {
      id: "u-1",
      name: "Alex Johnson",
      avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=Alex",
      role: "student"
    },
    content: "<p>I am a bit confused about RSCs. If they render entirely on the server, how do we use <code>useState</code> or handle interactivity? Do we have to pass state down to client components via props?</p>",
    createdAt: "2026-08-05T10:00:00Z",
    tags: ["React 19", "RSC", "State Management"],
    views: 142,
    isSolved: true,
    isPinned: true,
    isLocked: false,
    relatedLessonId: "l-201",
    relatedLessonTitle: "RSC vs Client Boundaries",
    replies: [
      {
        id: "r-1",
        author: {
          id: "t-1",
          name: "Sarah Chen",
          avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=Sarah",
          role: "teacher",
          isVerifiedTeacher: true
        },
        content: "<p>Great question Alex! Server Components <strong>cannot</strong> use state or lifecycle hooks (like <code>useState</code> or <code>useEffect</code>). They are meant for fetching data and rendering static HTML.</p><p>To add interactivity, you must create a Client Component (using <code>'use client'</code> at the top of the file). You can then pass data from the Server Component down to the Client Component as props.</p>",
        createdAt: "2026-08-05T10:15:00Z",
        likes: 24,
        isAcceptedAnswer: true,
        replies: [
          {
            id: "r-1-1",
            author: {
              id: "u-1",
              name: "Alex Johnson",
              avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=Alex",
              role: "student"
            },
            content: "<p>Ah, that makes perfect sense. So the Server Component acts as a data-wrapper for the interactive Client leaf nodes. Thank you!</p>",
            createdAt: "2026-08-05T10:20:00Z",
            likes: 5
          }
        ]
      }
    ]
  },
  {
    id: "dt-2",
    title: "Course Update: New Module on Suspense added!",
    type: "announcement",
    author: {
      id: "t-1",
      name: "Sarah Chen",
      avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=Sarah",
      role: "teacher",
      isVerifiedTeacher: true
    },
    content: "<p>Hello everyone! I've just published a brand new section covering deep-dive patterns into React Suspense and Streaming. Be sure to check it out in Module 2.</p>",
    createdAt: "2026-08-06T08:00:00Z",
    tags: ["Announcement", "Course Update"],
    views: 350,
    isSolved: false,
    isPinned: true,
    isLocked: true, // Announcements are often locked
    replies: []
  },
  {
    id: "dt-3",
    title: "Best practice for structuring Tailwind config?",
    type: "discussion",
    author: {
      id: "u-2",
      name: "Marcus Lee",
      avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=Marcus",
      role: "student"
    },
    content: "<p>With Tailwind v4, what is the recommended way to structure large enterprise themes? Should we still use extensive CSS variables, or rely entirely on the new engine's capabilities?</p>",
    createdAt: "2026-08-06T14:30:00Z",
    tags: ["Tailwind CSS", "Architecture"],
    views: 45,
    isSolved: false,
    isPinned: false,
    isLocked: false,
    replies: []
  }
];
