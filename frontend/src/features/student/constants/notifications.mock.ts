import { subMinutes, subHours, subDays } from "date-fns";

export type NotificationCategory = "announcements" | "live_classes" | "courses" | "resources" | "payments" | "attendance" | "achievements" | "system";
export type NotificationPriority = "critical" | "high" | "medium" | "low";

export interface Notification {
  id: string;
  type: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  description: string;
  fullMessage?: string;
  courseTitle?: string;
  isRead: boolean;
  timestamp: string; // ISO string
  actionUrl?: string;
  actionText?: string;
}

export interface ActivityEvent {
  id: string;
  type: "lesson_completed" | "video_watched" | "pdf_read" | "live_class_joined" | "achievement_earned" | "course_purchased" | "bookmark_added";
  title: string;
  timestamp: string;
  courseTitle?: string;
}

const now = new Date();

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "notif-1",
    type: "live_class_starting",
    category: "live_classes",
    priority: "critical",
    title: "Live Class Starting Soon",
    description: "System Design: Scalability Patterns starts in 15 minutes.",
    fullMessage: "Your live session for System Design: Scalability Patterns is starting in exactly 15 minutes. Please join the waiting room. Make sure your microphone and camera are tested.",
    courseTitle: "System Design for Interviews",
    isRead: false,
    timestamp: subMinutes(now, 5).toISOString(),
    actionUrl: "/student/live",
    actionText: "Join Waiting Room",
  },
  {
    id: "notif-2",
    type: "new_announcement",
    category: "announcements",
    priority: "high",
    title: "Curriculum Update",
    description: "New modules added to React Architecture course.",
    fullMessage: "We have just pushed a major curriculum update to the React Architecture course, covering the latest Next.js 15 features including Server Actions and Partial Prerendering. Dive in to module 4 to see the new content.",
    courseTitle: "React Architecture: Enterprise Scale",
    isRead: false,
    timestamp: subHours(now, 2).toISOString(),
    actionUrl: "/student/courses/1",
    actionText: "View Course",
  },
  {
    id: "notif-3",
    type: "payment_success",
    category: "payments",
    priority: "medium",
    title: "Payment Successful",
    description: "Your receipt for Advanced Data Structures is ready.",
    fullMessage: "Thank you for your purchase. We have successfully processed your payment of $89.99 for the Advanced Data Structures course. You can download your invoice from the billing dashboard.",
    courseTitle: "Advanced Data Structures",
    isRead: true,
    timestamp: subDays(now, 1).toISOString(),
    actionUrl: "/student/billing",
    actionText: "View Receipt",
  },
  {
    id: "notif-4",
    type: "achievement_unlocked",
    category: "achievements",
    priority: "low",
    title: "Achievement Unlocked: Night Owl",
    description: "You completed 3 lessons after midnight.",
    fullMessage: "Congratulations! You've unlocked the 'Night Owl' badge for completing multiple lessons between 12:00 AM and 4:00 AM. Keep up the dedication!",
    isRead: true,
    timestamp: subDays(now, 2).toISOString(),
  },
  {
    id: "notif-5",
    type: "recording_uploaded",
    category: "resources",
    priority: "medium",
    title: "Recording Available",
    description: "The recording for 'WebSockets & Real-time' is now available.",
    fullMessage: "Missed the live class? No problem. The VOD recording and transcripts for 'WebSockets & Real-time' have been uploaded to the resources library.",
    courseTitle: "System Design for Interviews",
    isRead: false,
    timestamp: subDays(now, 3).toISOString(),
    actionUrl: "/student/resources",
    actionText: "Watch Recording",
  },
];

export const MOCK_ACTIVITY: ActivityEvent[] = [
  {
    id: "act-1",
    type: "lesson_completed",
    title: "Completed 'Server Components Deep Dive'",
    timestamp: subHours(now, 1).toISOString(),
    courseTitle: "React Architecture: Enterprise Scale",
  },
  {
    id: "act-2",
    type: "achievement_earned",
    title: "Earned 'Fast Learner' Badge",
    timestamp: subHours(now, 24).toISOString(),
  },
  {
    id: "act-3",
    type: "pdf_read",
    title: "Read 'System Design Cheat Sheet'",
    timestamp: subDays(now, 2).toISOString(),
    courseTitle: "System Design for Interviews",
  },
  {
    id: "act-4",
    type: "course_purchased",
    title: "Purchased 'Advanced Data Structures'",
    timestamp: subDays(now, 5).toISOString(),
  }
];
