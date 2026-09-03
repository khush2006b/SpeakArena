import type { Metadata } from "next";
import { PricingSection } from "@/features/marketing/components/PricingSection";

export const metadata: Metadata = {
  title: "Pricing | Speak Arena",
  description: "Transparent pricing for all Speak Arena English learning plans.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <PricingSection />
    </div>
  );
}
