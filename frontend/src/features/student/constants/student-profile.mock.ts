import { subDays, subHours } from "date-fns";

const now = new Date();

export const MOCK_STUDENT_PROFILE = {
  id: "std_001",
  fullName: "Alex Rivera",
  email: "alex.rivera@example.com",
  avatarUrl: "https://i.pravatar.cc/150?u=alexr",
  coverUrl: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop",
  timezone: "America/Los_Angeles (PST)",
  language: "English",
  country: "United States",
  bio: "Frontend engineer transitioning to full-stack. Passionate about web performance and scalable systems.",
  memberSince: "2024-01-15T00:00:00Z",
  profileCompletion: 85,
  isEmailVerified: true,
  lastLogin: subHours(now, 2).toISOString(),
  learningInterests: ["React", "System Design", "Node.js", "TypeScript"],
};

export const MOCK_LEARNING_STATS = {
  coursesEnrolled: 4,
  coursesCompleted: 1,
  hoursLearned: 104.5,
  currentStreak: 12, // days
  longestStreak: 21, // days
  perfectAttendance: 95, // percentage
  certificatesEarned: 1,
};

export const MOCK_CURRENT_LEARNING = {
  courseTitle: "React Architecture: Enterprise Scale",
  currentModule: "Server Components & Server Actions",
  progress: 68,
  nextLiveClass: {
    title: "Q&A: Server Actions Deep Dive",
    date: "Tomorrow, 10:00 AM"
  },
  estimatedCompletion: "2 weeks"
};

export const MOCK_ACHIEVEMENTS = [
  { id: "ach_1", title: "First Step", description: "Completed your first lesson.", icon: "footprints", earnedAt: subDays(now, 180).toISOString() },
  { id: "ach_2", title: "Night Owl", description: "Completed 3 lessons after midnight.", icon: "moon", earnedAt: subDays(now, 45).toISOString() },
  { id: "ach_3", title: "7-Day Streak", description: "Studied for 7 consecutive days.", icon: "flame", earnedAt: subDays(now, 60).toISOString() },
  { id: "ach_4", title: "100 Hours Club", description: "Reached 100 total hours of learning.", icon: "clock", earnedAt: subDays(now, 2).toISOString() },
  { id: "ach_5", title: "Top 10%", description: "Scored in the top 10% of a cohort.", icon: "trophy", isLocked: true },
  { id: "ach_6", title: "Perfect Attendance", description: "Attended all live classes in a course.", icon: "calendar", isLocked: true },
];

export const MOCK_PROFILE_TIMELINE = [
  { id: "tl_1", type: "achievement", title: "Unlocked '100 Hours Club'", timestamp: subDays(now, 2).toISOString() },
  { id: "tl_2", type: "course_complete", title: "Completed 'Advanced Data Structures'", timestamp: subDays(now, 15).toISOString() },
  { id: "tl_3", type: "live_class", title: "Attended 'System Design Q&A'", timestamp: subDays(now, 20).toISOString() },
  { id: "tl_4", type: "course_purchase", title: "Enrolled in 'React Architecture'", timestamp: subDays(now, 21).toISOString() },
];

export const MOCK_LEARNING_GOALS = {
  dailyMinutesTarget: 60,
  dailyMinutesCurrent: 45,
  weeklyLessonsTarget: 5,
  weeklyLessonsCurrent: 3,
};
