import React from "react";
import { CourseShowcaseSection } from "@/features/marketing/components/CourseShowcaseSection";

export const metadata = {
  title: "Explore Courses | SpeakArena",
  description: "Browse all Spoken English, Accent Reduction, and IELTS preparation courses.",
};

export default function PublicCoursesPage() {
  return (
    <>
      <CourseShowcaseSection />
    </>
  );
}
