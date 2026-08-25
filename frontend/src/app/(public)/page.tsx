
import { MavenHeroSection } from "@/features/marketing/components/MavenHeroSection";
import { FeaturesSection } from "@/features/marketing/components/FeaturesSection";
import { CourseShowcaseSection } from "@/features/marketing/components/CourseShowcaseSection";
import { TeacherSection } from "@/features/marketing/components/TeacherSection";
import { PricingSection } from "@/features/marketing/components/PricingSection";
import { FAQSection } from "@/features/marketing/components/FAQSection";
import { ContactSection } from "@/features/marketing/components/ContactSection";

export default function LandingPage() {
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
