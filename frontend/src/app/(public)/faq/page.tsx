import type { Metadata } from "next";
import { FAQSection } from "@/features/marketing/components/FAQSection";

export const metadata: Metadata = {
  title: "FAQ | SpeakArena",
  description: "Frequently asked questions about SpeakArena courses, pricing, and platform features.",
};

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-background">
      <FAQSection />
    </div>
  );
}
