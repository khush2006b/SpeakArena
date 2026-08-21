const PLACEHOLDER_1 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'><defs><linearGradient id='g1' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%231e1b4b'/><stop offset='100%' stop-color='%234338ca'/></linearGradient></defs><rect width='800' height='450' fill='url(%23g1)'/><circle cx='400' cy='225' r='120' fill='%236366f1' opacity='0.25'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23e0e7ff' font-family='system-ui, sans-serif' font-size='28' font-weight='700'>Fluency %26 Accent</text></svg>";
const PLACEHOLDER_2 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'><defs><linearGradient id='g2' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%23064e3b'/><stop offset='100%' stop-color='%23059669'/></linearGradient></defs><rect width='800' height='450' fill='url(%23g2)'/><circle cx='400' cy='225' r='120' fill='%2310b981' opacity='0.25'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23ecfdf5' font-family='system-ui, sans-serif' font-size='28' font-weight='700'>Business English</text></svg>";
const PLACEHOLDER_3 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'><defs><linearGradient id='g3' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%23581c87'/><stop offset='100%' stop-color='%237e22ce'/></linearGradient></defs><rect width='800' height='450' fill='url(%23g3)'/><circle cx='400' cy='225' r='120' fill='%23a855f7' opacity='0.25'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23faf5ff' font-family='system-ui, sans-serif' font-size='28' font-weight='700'>Exam Prep</text></svg>";
const PLACEHOLDER_4 = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'><defs><linearGradient id='g4' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%231e293b'/><stop offset='100%' stop-color='%23334155'/></linearGradient></defs><rect width='800' height='450' fill='url(%23g4)'/><circle cx='400' cy='225' r='120' fill='%2394a3b8' opacity='0.25'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23f8fafc' font-family='system-ui, sans-serif' font-size='28' font-weight='700'>Grammar %26 Vocab</text></svg>";

export const MOCK_LIBRARY_COURSES = [
  {
    id: "c-101",
    title: "Spoken English & Accent Reduction Masterclass",
    description: "Master natural pronunciation, vowel stress, and accent reduction with live Google Meet practice sessions and downloadable speech audio drills.",
    thumbnail: PLACEHOLDER_1,
    teacher: "Paras (Construction)",
    category: "Fluency & Accent",
    progress: 65,
    totalModules: 12,
    completedModules: 8,
    lastWatched: "2 hours ago",
    isFavorite: true,
    upcomingClass: {
      title: "Live Session: Vowel Sounds & Pitch Control",
      startsIn: "45 mins"
    }
  },
  {
    id: "c-102",
    title: "Executive Business Communication",
    description: "Elevate your professional English, boardroom presentations, corporate pitches, and executive email correspondence with interactive feedback.",
    thumbnail: PLACEHOLDER_2,
    teacher: "Paras (Construction)",
    category: "Business English",
    progress: 32,
    totalModules: 8,
    completedModules: 2,
    lastWatched: "Yesterday",
    isFavorite: false,
  },
  {
    id: "c-103",
    title: "IELTS & TOEFL Speaking Band 8+ Strategy",
    description: "Comprehensive preparation for IELTS/TOEFL speaking tests, including live 1-on-1 mock interviews, fluency scoring, and vocabulary expansion.",
    thumbnail: PLACEHOLDER_3,
    teacher: "Paras (Construction)",
    category: "Exam Prep",
    progress: 100,
    totalModules: 5,
    completedModules: 5,
    lastWatched: "2 weeks ago",
    isFavorite: true,
  },
  {
    id: "c-104",
    title: "Advanced English Grammar & Vocabulary",
    description: "Master complex sentence structures, idiom usage, phrasal verbs, and nuance in formal written and conversational English.",
    thumbnail: PLACEHOLDER_4,
    teacher: "Paras (Construction)",
    category: "Grammar & Vocab",
    progress: 15,
    totalModules: 10,
    completedModules: 1,
    lastWatched: "3 days ago",
    isFavorite: false,
  },
  {
    id: "c-105",
    title: "Confidence in Public Speaking & Debate",
    description: "Build unshakeable speech confidence, master audience engagement techniques, impromptu speaking, and argumentative debate structures.",
    thumbnail: PLACEHOLDER_1,
    teacher: "Paras (Construction)",
    category: "Public Speaking",
    progress: 40,
    totalModules: 6,
    completedModules: 2,
    lastWatched: "4 days ago",
    isFavorite: false,
  },
  {
    id: "c-106",
    title: "Everyday Conversational Fluency",
    description: "Learn practical vocabulary, idioms, slang, and small talk for casual social settings, traveling, and daily interactions.",
    thumbnail: PLACEHOLDER_2,
    teacher: "Paras (Construction)",
    category: "Conversational",
    progress: 0,
    totalModules: 7,
    completedModules: 0,
    lastWatched: "Not started",
    isFavorite: false,
  }
];
