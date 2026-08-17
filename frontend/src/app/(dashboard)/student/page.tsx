import { Metadata } from "next";
import { DashboardHero } from "@/features/student/components/dashboard/DashboardHero";
import { LearningStreakWidget } from "@/features/student/components/dashboard/LearningStreakWidget";
import { NextLiveClassCard } from "@/features/student/components/dashboard/NextLiveClassCard";
import { CourseCarousel } from "@/features/student/components/dashboard/CourseCarousel";
import { DashboardCalendar } from "@/features/student/components/dashboard/DashboardCalendar";
import { RecentActivityFeed } from "@/features/student/components/dashboard/RecentActivityFeed";
import { AnnouncementsWidget } from "@/features/student/components/dashboard/AnnouncementsWidget";
import { MOCK_DASHBOARD_DATA } from "@/features/student/constants/student-dashboard.mock";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your personalized learning dashboard.",
};

export default function StudentDashboardPage() {
  const { enrolledCourses, recommendedCourses } = MOCK_DASHBOARD_DATA;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, paddingBottom: 40 }}>
      
      {/* 1. Cinematic Hero / Continue Learning */}
      <section>
        <DashboardHero />
      </section>

      {/* 2. Gamification & Urgent Actions */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }} className="grid-cols-1 md:grid-cols-2">
        <LearningStreakWidget />
        <NextLiveClassCard />
      </section>

      {/* 3. My Courses Carousel */}
      <section>
        <CourseCarousel title="My Courses" items={enrolledCourses} type="enrolled" />
      </section>

      {/* 4. Auxiliary Information Grid */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }} className="grid-cols-1 lg:grid-cols-3">
        <DashboardCalendar />
        <RecentActivityFeed />
        <AnnouncementsWidget />
      </section>

      {/* 5. Discovery / Recommendations */}
      <section>
        <CourseCarousel title="Recommended For You" items={recommendedCourses} type="recommended" />
      </section>

    </div>
  );
}
