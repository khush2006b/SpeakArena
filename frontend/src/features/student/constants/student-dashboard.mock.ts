const SVG_BG_1 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'><defs><linearGradient id='g1' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%231e1b4b'/><stop offset='100%' stop-color='%234338ca'/></linearGradient></defs><rect width='800' height='450' fill='url(%23g1)'/></svg>";
const SVG_BG_2 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'><defs><linearGradient id='g2' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%23064e3b'/><stop offset='100%' stop-color='%23059669'/></linearGradient></defs><rect width='800' height='450' fill='url(%23g2)'/></svg>";
const SVG_BG_3 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'><defs><linearGradient id='g3' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%2378350f'/><stop offset='100%' stop-color='%23d97706'/></linearGradient></defs><rect width='800' height='450' fill='url(%23g3)'/></svg>";

export const MOCK_DASHBOARD_DATA = {
  hero: {
    courseId: "c-101",
    courseTitle: "Spoken English & Accent Reduction Masterclass",
    lessonTitle: "Module 3: Vowel Stress & Natural Speech Rhythm",
    thumbnail: SVG_BG_1,
    gradient: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)",
    category: "Accent & Pronunciation",
    progress: 65, // percent
    timeRemaining: "12 mins left",
  },
  learningStreak: {
    currentStreak: 5,
    longestStreak: 14,
    weeklyGoal: 7, // days
    daysActiveThisWeek: 4,
    totalHoursLearned: 124,
  },
  nextLiveClass: {
    id: "m-202",
    title: "Live Session: Interactive Pronunciation & Pitch Drill",
    courseTitle: "Executive Business Communication",
    teacherName: "Alex Rivera",
    startsIn: "45 mins",
    scheduledAt: "2026-08-08T10:30:00.000Z",
  },
  enrolledCourses: [
    {
      id: "c-101",
      title: "Spoken English & Accent Reduction Masterclass",
      thumbnail: SVG_BG_1,
      gradient: "linear-gradient(135deg, #312e81 0%, #4338ca 60%, #6366f1 100%)",
      iconType: "mic",
      category: "Accent",
      progress: 65,
      lastWatched: "2 hours ago",
    },
    {
      id: "c-102",
      title: "Executive Business Communication",
      thumbnail: SVG_BG_2,
      gradient: "linear-gradient(135deg, #064e3b 0%, #047857 60%, #10b981 100%)",
      iconType: "briefcase",
      category: "Business",
      progress: 32,
      lastWatched: "Yesterday",
    },
    {
      id: "c-103",
      title: "IELTS Speaking Band 8+ Masterclass",
      thumbnail: SVG_BG_3,
      gradient: "linear-gradient(135deg, #78350f 0%, #b45309 60%, #f59e0b 100%)",
      iconType: "award",
      category: "IELTS Prep",
      progress: 10,
      lastWatched: "3 days ago",
    }
  ],
  recommendedCourses: [
    {
      id: "c-104",
      title: "Public Speaking & Impromptu Debates",
      thumbnail: SVG_BG_1,
      category: "Public Speaking",
      rating: 4.9,
      studentsCount: 1420,
    },
    {
      id: "c-105",
      title: "Advanced English Vocabulary Expansion",
      thumbnail: SVG_BG_2,
      category: "Vocabulary",
      rating: 4.8,
      studentsCount: 890,
    }
  ]
};
