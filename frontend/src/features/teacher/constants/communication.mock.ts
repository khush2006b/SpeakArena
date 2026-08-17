import { Channel, Message, User } from "@/stores/communication.store";

export const MOCK_USERS: Record<string, User> = {
  "usr-teacher": {
    id: "usr-teacher",
    name: "Dr. Eleanor Vance",
    avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704a",
    status: "online",
    role: "teacher"
  },
  "usr-1": {
    id: "usr-1",
    name: "Alex Rivera",
    avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704d",
    status: "online",
    role: "student"
  },
  "usr-2": {
    id: "usr-2",
    name: "Sarah Chen",
    avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704e",
    status: "idle",
    role: "student"
  },
  "usr-3": {
    id: "usr-3",
    name: "Marcus Johnson",
    avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704f",
    status: "offline",
    role: "student"
  }
};

export const MOCK_CHANNELS: Channel[] = [
  { id: "chan-ann", name: "Announcements", type: "announcement", unreadCount: 0 },
  { id: "chan-1", name: "Spoken English & Accent Reduction", type: "course", unreadCount: 3 },
  { id: "chan-2", name: "Executive Business Communication", type: "course", unreadCount: 0 },
  { id: "chan-live", name: "Live: Pronunciation Q&A", type: "live", unreadCount: 12 },
  { id: "chan-dm-1", name: "Alex Rivera", type: "direct", unreadCount: 1, isPrivate: true },
];

export const MOCK_MESSAGES: Message[] = [
  {
    id: "msg-1",
    channelId: "chan-1",
    user: null,
    content: "Welcome to the Spoken English & Accent Reduction channel! Please keep discussions on-topic.",
    timestamp: "2026-08-01T09:00:00Z",
    type: "system",
    isPinned: true
  },
  {
    id: "msg-2",
    channelId: "chan-1",
    user: MOCK_USERS["usr-teacher"],
    content: "Hi everyone! I've uploaded the speech audio drills syllabus for this week. Please review it before our live Google Meet session on Thursday.",
    timestamp: "2026-08-01T10:15:00Z",
    type: "text",
    isAnnouncement: true,
    attachments: [
      { name: "Week1_Phonetics_Syllabus.pdf", url: "#", type: "pdf" }
    ]
  },
  {
    id: "msg-3",
    channelId: "chan-1",
    user: MOCK_USERS["usr-1"],
    content: "Thanks Dr. Vance! I had a quick question regarding the vowel modulation speech assignment. Should we record our audio in MP3 format?",
    timestamp: "2026-08-06T14:20:00Z",
    type: "text"
  },
  {
    id: "msg-4",
    channelId: "chan-1",
    user: MOCK_USERS["usr-2"],
    content: "I was wondering the same thing. I found this intonation chart helpful though:",
    timestamp: "2026-08-06T14:25:00Z",
    type: "file",
    attachments: [
      { name: "intonation_chart.png", url: "#", type: "image" }
    ]
  },
  {
    id: "msg-5",
    channelId: "chan-1",
    user: MOCK_USERS["usr-teacher"],
    content: "Great question Alex. Yes, MP3 or WAV format works great for the assignment. We will practice live pitch control in our Google Meet session.",
    timestamp: "2026-08-06T14:32:00Z",
    type: "text"
  }
];
