import type { Metadata } from "next";
import { PricingSection } from "@/features/marketing/components/PricingSection";

export const metadata: Metadata = {
  title: "Pricing | SpeakArena",
  description: "Transparent pricing for all SpeakArena English learning plans.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <PricingSection />
    </div>
  );
}
