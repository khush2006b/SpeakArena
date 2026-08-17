import { Metadata } from "next";
import { BillingDashboard } from "@/features/student/components/billing/BillingDashboard";

export const metadata: Metadata = {
  title: "Billing & Purchases - SpeakArena",
  description: "Manage your course purchases, receipts, and invoices.",
};

export default function BillingPage() {
  return (
    <div className="flex-1 w-full bg-background overflow-y-auto custom-scrollbar">
      <BillingDashboard />
    </div>
  );
}
