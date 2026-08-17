/**
 * Static site configuration.
 *
 * Centralises all site-wide constants: name, URLs, social links,
 * and navigation definitions. Import from here — never hardcode
 * these values in components.
 */

import { ROUTES } from "@/constants/routes";

export const siteConfig = {
  name: "SpeakArena",
  description:
    "Master programming, DSA, Java, Python, and interview preparation with expert-led courses and live classes.",
  url: process.env["NEXT_PUBLIC_APP_URL"] ?? "https://speakarena.com",
  apiUrl: process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:8000",
  ogImage: "/og.png",
  links: {
    twitter: "https://twitter.com/speakarena",
    github: "https://github.com/speakarena",
    youtube: "https://youtube.com/@speakarena",
  },
} as const;

// ---------------------------------------------------------------------------
// Public navigation (marketing site header)
// ---------------------------------------------------------------------------

export const publicNav = [
  { label: "Courses", href: ROUTES.STUDENT.COURSES },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
] as const;

// ---------------------------------------------------------------------------
// Student sidebar navigation
// ---------------------------------------------------------------------------

export const studentNav = [
  {
    label: "Dashboard",
    href: ROUTES.STUDENT.DASHBOARD,
    icon: "LayoutDashboard",
  },
  {
    label: "My Courses",
    href: ROUTES.STUDENT.COURSES,
    icon: "BookOpen",
  },
  {
    label: "Notifications",
    href: ROUTES.STUDENT.NOTIFICATIONS,
    icon: "Bell",
  },
  {
    label: "Progress",
    href: ROUTES.STUDENT.PROGRESS,
    icon: "TrendingUp",
  },
  {
    label: "Profile",
    href: ROUTES.STUDENT.PROFILE,
    icon: "User",
  },
] as const;

// ---------------------------------------------------------------------------
// Teacher sidebar navigation
// ---------------------------------------------------------------------------

export const teacherNav = [
  {
    label: "Dashboard",
    href: ROUTES.TEACHER.DASHBOARD,
    icon: "LayoutDashboard",
  },
  {
    label: "Courses",
    href: ROUTES.TEACHER.COURSES,
    icon: "BookOpen",
  },
  {
    label: "Analytics",
    href: ROUTES.TEACHER.ANALYTICS,
    icon: "BarChart2",
  },
  {
    label: "Students",
    href: ROUTES.TEACHER.STUDENTS,
    icon: "Users",
  },
  {
    label: "Live Sessions",
    href: ROUTES.TEACHER.LIVE,
    icon: "Video",
  },
  {
    label: "Payments",
    href: ROUTES.TEACHER.PAYMENTS,
    icon: "CreditCard",
  },
  {
    label: "Notifications",
    href: ROUTES.TEACHER.NOTIFICATIONS,
    icon: "Bell",
  },
] as const;
