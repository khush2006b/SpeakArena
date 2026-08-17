import { Metadata } from "next";
import { FinanceHeader } from "@/features/teacher/components/finance/FinanceHeader";
import { FinanceKPIs } from "@/features/teacher/components/finance/FinanceKPIs";
import { BusinessInsights } from "@/features/teacher/components/finance/BusinessInsights";
import RevenueCharts from "@/features/teacher/components/finance/RevenueCharts";
import PaymentDistribution from "@/features/teacher/components/finance/PaymentDistribution";
import GeographicalMap from "@/features/teacher/components/finance/GeographicalMap";
import TransactionTable from "@/features/teacher/components/finance/TransactionTable";
import TransactionDrawer from "@/features/teacher/components/finance/TransactionDrawer";

export const metadata: Metadata = {
  title: "Revenue & Payments",
  description: "Enterprise financial analytics, transactions, and revenue tracking.",
};

export default function FinancePage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-8 pb-24 space-y-8 min-h-screen flex flex-col">
      <FinanceHeader />
      <FinanceKPIs />
      <BusinessInsights />
      
      {/* Chart Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <RevenueCharts />
        </div>
        <div>
          <PaymentDistribution />
        </div>
      </div>

      <GeographicalMap />

      <TransactionTable />

      <TransactionDrawer />
    </div>
  );
}
