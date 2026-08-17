import { addDays, subDays, setHours, setMinutes } from "date-fns";
import { Meeting } from "@/stores/meeting.store";

const today = new Date();

export const MOCK_MEETINGS: Meeting[] = [
  {
    id: "mtg-1",
    title: "Spoken English & Pronunciation Live Session",
    courseId: "course-1",
    courseName: "Spoken English & Accent Reduction Masterclass",
    start: setMinutes(setHours(today, 10), 0),
    end: setMinutes(setHours(today, 11), 30),
    status: "Live",
    meetLink: "https://meet.google.com/abc-defg-hij",
    isRecurring: true,
    attendance: { present: 45, absent: 5, late: 2, total: 50 }
  },
  {
    id: "mtg-2",
    title: "Executive Pitching & Business Writing Drills",
    courseId: "course-2",
    courseName: "Executive Business Communication",
    start: setMinutes(setHours(today, 14), 0),
    end: setMinutes(setHours(today, 15), 0),
    status: "Scheduled",
    meetLink: "https://meet.google.com/xyz-uvw-qrs",
    isRecurring: false,
  },
  {
    id: "mtg-3",
    title: "IELTS Speaking Band 8+ Live Mock Interview",
    courseId: "course-1",
    courseName: "IELTS & TOEFL Speaking Band 8+ Masterclass",
    start: setMinutes(setHours(addDays(today, 1), 9), 0),
    end: setMinutes(setHours(addDays(today, 1), 10), 30),
    status: "Scheduled",
    meetLink: "https://meet.google.com/test-link",
    isRecurring: true,
  },
  {
    id: "mtg-4",
    title: "Public Speaking & Impromptu Speech Workshop",
    courseId: "course-3",
    courseName: "Public Speaking, Debates & Persuasive Rhetoric",
    start: setMinutes(setHours(subDays(today, 2), 16), 0),
    end: setMinutes(setHours(subDays(today, 2), 17), 30),
    status: "Completed",
    isRecurring: false,
    attendance: { present: 30, absent: 2, late: 0, total: 32 }
  },
  {
    id: "mtg-5",
    title: "Grammar & Phrasal Verbs Q&A",
    courseId: "course-2",
    courseName: "Advanced English Grammar & Vocabulary",
    start: setMinutes(setHours(addDays(today, 3), 11), 0),
    end: setMinutes(setHours(addDays(today, 3), 12), 0),
    status: "Cancelled",
    isRecurring: true,
  }
];
