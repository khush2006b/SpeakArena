import type { Metadata } from "next";
import { ContactSection } from "@/features/marketing/components/ContactSection";

export const metadata: Metadata = {
  title: "Contact Us | Speak Arena",
  description: "Get in touch with the Speak Arena team for support, partnerships, or enterprise inquiries.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <ContactSection />
    </div>
  );
}
