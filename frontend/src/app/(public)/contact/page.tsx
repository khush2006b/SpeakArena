import type { Metadata } from "next";
import { ContactSection } from "@/features/marketing/components/ContactSection";

export const metadata: Metadata = {
  title: "Contact Us | SpeakArena",
  description: "Get in touch with the SpeakArena team for support, partnerships, or enterprise inquiries.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <ContactSection />
    </div>
  );
}
