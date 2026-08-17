import { subDays, format } from "date-fns";

export interface TopicData {
  topic: string;
  mastery: number;
  fullMark: number;
}

export interface ActivityDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export const MOCK_TOPIC_DATA: TopicData[] = [
  { topic: "Arrays", mastery: 90, fullMark: 100 },
  { topic: "Trees", mastery: 65, fullMark: 100 },
  { topic: "Graphs", mastery: 40, fullMark: 100 },
  { topic: "DP", mastery: 30, fullMark: 100 },
  { topic: "Recursion", mastery: 85, fullMark: 100 },
  { topic: "Sorting", mastery: 95, fullMark: 100 },
];

export const MOCK_SUMMARY = {
  overallProgress: 68,
  hoursStudied: 142.5,
  lessonsCompleted: 84,
  currentStreak: 12,
  longestStreak: 45,
  videosWatched: 56,
  pdfsRead: 14,
  liveClassesAttended: 8
};

export const MOCK_ACHIEVEMENTS = [
  { id: "1", title: "7-Day Streak", description: "Studied for 7 consecutive days.", icon: "flame", unlockedAt: "2026-07-15T00:00:00Z" },
  { id: "2", title: "First Course", description: "Completed your first course.", icon: "award", unlockedAt: "2026-06-20T00:00:00Z" },
  { id: "3", title: "100 Lessons", description: "Completed 100 total lessons.", icon: "book-open", unlockedAt: null },
  { id: "4", title: "Night Learner", description: "Studied past midnight 5 times.", icon: "moon", unlockedAt: "2026-08-01T00:00:00Z" },
  { id: "5", title: "Perfect Attendance", description: "Attended all live classes in a month.", icon: "calendar-check", unlockedAt: null },
];

export const MOCK_INSIGHTS = [
  { id: "i1", text: "You study best in the evening, maintaining a 25% higher completion rate.", type: "positive" },
  { id: "i2", text: "Your average study session is 42 minutes.", type: "neutral" },
  { id: "i3", text: "You are currently 12% ahead of your monthly goal schedule. Keep it up!", type: "positive" }
];

// Generate 365 days of mock heatmap data ending today
export const generateHeatmapData = (): ActivityDay[] => {
  const data: ActivityDay[] = [];
  const today = new Date();
  
  for (let i = 364; i >= 0; i--) {
    const date = subDays(today, i);
    
    // Create somewhat realistic sparse data (more activity recently)
    let count = 0;
    const isRecent = i < 60;
    const random = Math.random();
    
    if (isRecent) {
      if (random > 0.3) count = Math.floor(Math.random() * 10) + 1;
    } else {
      if (random > 0.7) count = Math.floor(Math.random() * 5) + 1;
    }

    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (count === 0) level = 0;
    else if (count <= 2) level = 1;
    else if (count <= 5) level = 2;
    else if (count <= 8) level = 3;
    else level = 4;

    data.push({
      date: format(date, "yyyy-MM-dd"),
      count,
      level
    });
  }
  return data;
};
