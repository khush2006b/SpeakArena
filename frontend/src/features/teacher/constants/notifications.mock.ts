import { Notification } from "@/stores/notifications.store";

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "notif-1",
    title: "Payment Failed",
    description: "A scheduled payment for 'Spoken English & Accent Reduction Masterclass' failed to process due to insufficient funds.",
    type: "payment",
    priority: "critical",
    timestamp: "2026-08-06T15:30:00Z",
    isRead: false,
    studentName: "Alex Rivera",
    studentAvatar: "https://i.pravatar.cc/150?u=a042581f4e29026704d",
    courseName: "Spoken English & Accent Reduction Masterclass",
    amount: 450.00
  },
  {
    id: "notif-2",
    title: "New Student Enrolled",
    description: "Sarah Chen just purchased 'Executive Business Communication'.",
    type: "student",
    priority: "medium",
    timestamp: "2026-08-06T14:15:00Z",
    isRead: false,
    studentName: "Sarah Chen",
    studentAvatar: "https://i.pravatar.cc/150?u=a042581f4e29026704e",
    courseName: "Executive Business Communication",
    amount: 299.00
  },
  {
    id: "notif-3",
    title: "Live Google Meet Class Starts Soon",
    description: "Your live session for 'Spoken English & Accent Reduction Masterclass' starts in 15 minutes.",
    type: "meeting",
    priority: "high",
    timestamp: "2026-08-06T13:45:00Z",
    isRead: true,
    courseName: "Spoken English & Accent Reduction Masterclass"
  },
  {
    id: "notif-4",
    title: "System Update Complete",
    description: "SpeakArena platform has been updated to v2.4.0. All systems operational.",
    type: "system",
    priority: "low",
    timestamp: "2026-08-05T02:00:00Z",
    isRead: true
  },
  {
    id: "notif-5",
    title: "Video Processing Completed",
    description: "Module 4: Pitch Control & Intonation Drills video has finished rendering and is now live.",
    type: "upload",
    priority: "medium",
    timestamp: "2026-08-04T18:20:00Z",
    isRead: true,
    courseName: "Spoken English & Accent Reduction Masterclass"
  },
  {
    id: "notif-6",
    title: "New Message Received",
    description: "Marcus asked a question regarding the speech assignment in the discussion channel.",
    type: "message",
    priority: "high",
    timestamp: "2026-08-04T10:15:00Z",
    isRead: false,
    studentName: "Marcus Johnson",
    studentAvatar: "https://i.pravatar.cc/150?u=a042581f4e29026704f",
    courseName: "Spoken English & Accent Reduction Masterclass"
  }
];

export const MOCK_ACTIVITY_TIMELINE = [
  { id: "act-1", title: "Course Created", timestamp: "2026-07-01T09:00:00Z", type: "system" },
  { id: "act-2", title: "First Student Enrolled", timestamp: "2026-07-02T14:30:00Z", type: "student" },
  { id: "act-3", title: "First Live Class", timestamp: "2026-07-05T10:00:00Z", type: "meeting" },
  { id: "act-4", title: "100 Students Milestone", timestamp: "2026-07-20T16:45:00Z", type: "system" },
  { id: "act-5", title: "Payment Dispute Resolved", timestamp: "2026-08-01T11:20:00Z", type: "payment" },
];
