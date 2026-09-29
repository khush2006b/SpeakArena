"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Undo2,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceSummary } from "@/hooks/queries/useTeacherQueries";
import { useFinanceStore } from "@/stores/finance.store";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

const STATS = [
  {
    title: "Total Revenue",
    icon: DollarSign,
    iconClass: "text-emerald-400",
    iconBg: "bg-emerald-500/15 ring-1 ring-emerald-500/30",
    accentClass: "border-emerald-500/20",
    valueKey: "totalRevenue" as const,
    subtitle: "All-time verified earnings",
  },
  {
    title: "Revenue This Month",
    icon: TrendingUp,
    iconClass: "text-blue-400",
    iconBg: "bg-blue-500/15 ring-1 ring-blue-500/30",
    accentClass: "border-blue-500/20",
    valueKey: "revenueThisMonth" as const,
    subtitle: "Current billing cycle",
  },
  {
    title: "Today's Revenue",
    icon: CheckCircle2,
    iconClass: "text-indigo-400",
    iconBg: "bg-indigo-500/15 ring-1 ring-indigo-500/30",
    accentClass: "border-indigo-500/20",
    valueKey: "revenueToday" as const,
    subtitle: "Received today",
  },
  {
    title: "Transactions",
    icon: CreditCard,
    iconClass: "text-violet-400",
    iconBg: "bg-violet-500/15 ring-1 ring-violet-500/30",
    accentClass: "border-violet-500/20",
    valueKey: "totalTransactions" as const,
    subtitle: "Paid student enrollments",
  },
  {
    title: "Refunds / Disputed",
    icon: Undo2,
    iconClass: "text-amber-400",
    iconBg: "bg-amber-500/15 ring-1 ring-amber-500/30",
    accentClass: "border-amber-500/20",
    valueKey: "refundsThisMonth" as const,
    subtitle: "Total refund volume",
  },
];

export function FinanceKPIs() {
  const { dateRange, currency: storeCurrency } = useFinanceStore();
  const { data, isLoading } = useFinanceSummary(dateRange, storeCurrency);

  const symbol = storeCurrency === "USD" ? "$" : (storeCurrency === "INR" || data?.currency === "INR" ? "₹" : "₹");

  const formatAmount = (value: number) => {
    return `${symbol}${value.toLocaleString(storeCurrency === "USD" ? "en-US" : "en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  };

  const getValue = (stat: typeof STATS[0]) => {
    if (!data) return "—";
    const raw = (data as any)[stat.valueKey];
    if (stat.valueKey === "totalTransactions") {
      return Number(raw || 0).toLocaleString();
    }
    return formatAmount(Number(raw || 0));
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
    >
      {STATS.map((stat) => (
        <motion.div key={stat.title} variants={itemVariants} className="h-full">
          <div
            className={`card-stat hover-lift h-full flex flex-col justify-between border ${stat.accentClass} animate-fade-up bg-card/80 p-5 rounded-2xl`}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${stat.iconBg}`}
                >
                  <stat.icon className={`h-5 w-5 ${stat.iconClass}`} />
                </div>
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-7 w-28 mb-1 bg-white/5" />
                ) : (
                  <h2 className="text-foreground text-2xl font-bold tracking-tighter">
                    {getValue(stat)}
                  </h2>
                )}
                <p className="text-muted-foreground text-sm font-semibold mt-1">{stat.title}</p>
                <p className="text-muted-foreground/70 text-[11px] uppercase tracking-wider mt-0.5">
                  {stat.subtitle}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
