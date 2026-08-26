import { Metadata } from "next";
import { DashboardHero } from "@/features/student/components/dashboard/DashboardHero";
import { NextLiveClassCard } from "@/features/student/components/dashboard/NextLiveClassCard";
import { CourseCarousel } from "@/features/student/components/dashboard/CourseCarousel";
import { DashboardCalendar } from "@/features/student/components/dashboard/DashboardCalendar";
import { RecentActivityFeed } from "@/features/student/components/dashboard/RecentActivityFeed";
import { AnnouncementsWidget } from "@/features/student/components/dashboard/AnnouncementsWidget";


export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your personalized learning dashboard.",
};

export default function StudentDashboardPage() {
  return (
    <div className="flex flex-col gap-8 pb-10">
      
      {/* 1. Cinematic Hero / Continue Learning */}
      <section>
        <DashboardHero />
      </section>

      {/* 2. Urgent Actions */}
      <section>
        <NextLiveClassCard />
      </section>

      {/* 3. My Courses Carousel */}
      <section>
        <CourseCarousel title="My Courses" type="enrolled" />
      </section>

      {/* 4. Auxiliary Information Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <DashboardCalendar />
        <RecentActivityFeed />
        <AnnouncementsWidget />
      </section>

      {/* 5. Discovery / Recommendations */}
      <section>
        <CourseCarousel title="Recommended For You" type="recommended" />
      </section>

    </div>
  );
}
