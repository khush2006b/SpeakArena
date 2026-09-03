import type { Metadata } from "next";
import { FAQSection } from "@/features/marketing/components/FAQSection";

export const metadata: Metadata = {
  title: "FAQ | Speak Arena",
  description: "Frequently asked questions about Speak Arena courses, pricing, and platform features.",
};

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-background">
      <FAQSection />
    </div>
  );
}
