
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { MavenHeroSection } from "@/features/marketing/components/MavenHeroSection";
import { FeaturesSection } from "@/features/marketing/components/FeaturesSection";
import { CourseShowcaseSection } from "@/features/marketing/components/CourseShowcaseSection";
import { TeacherSection } from "@/features/marketing/components/TeacherSection";
import { PricingSection } from "@/features/marketing/components/PricingSection";
import { FAQSection } from "@/features/marketing/components/FAQSection";
import { ContactSection } from "@/features/marketing/components/ContactSection";

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      const role = String(user.role || "").toUpperCase();
      const dest = role === "TEACHER" ? "/teacher" : "/student";
      router.replace(dest);
    }
  }, [isAuthenticated, user, router]);

  if (isAuthenticated && user) {
    return null;
  }

  return (
    <div className="flex flex-col">
      <MavenHeroSection />

      <FeaturesSection />

      <CourseShowcaseSection />

      <TeacherSection />
      
      <PricingSection />
      
      <FAQSection />
      
      <ContactSection />
    </div>
  );
}
