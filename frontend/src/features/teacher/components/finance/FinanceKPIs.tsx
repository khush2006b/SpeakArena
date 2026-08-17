"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Undo2,
  Activity,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceSummary } from "@/hooks/queries/useTeacherQueries";

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
    subtitleKey: "revenueThisMonth" as const,
    valueKey: "totalRevenue" as const,
    staticSubtitle: null,
  },
  {
    title: "Revenue This Month",
    icon: TrendingUp,
    iconClass: "text-blue-400",
    iconBg: "bg-blue-500/15 ring-1 ring-blue-500/30",
    accentClass: "border-blue-500/20",
    subtitleKey: null,
    valueKey: "revenueThisMonth" as const,
    staticSubtitle: "Current billing period",
  },
  {
    title: "Pending Payouts",
    icon: CreditCard,
    iconClass: "text-amber-400",
    iconBg: "bg-amber-500/15 ring-1 ring-amber-500/30",
    accentClass: "border-amber-500/20",
    subtitleKey: null,
    valueKey: "pendingPayouts" as const,
    staticSubtitle: "Expected within 2–3 days",
  },
  {
    title: "Refunds",
    icon: Undo2,
    iconClass: "text-red-400",
    iconBg: "bg-red-500/15 ring-1 ring-red-500/30",
    accentClass: "border-red-500/20",
    subtitleKey: null,
    valueKey: "refundsThisMonth" as const,
    staticSubtitle: "This month",
  },
  {
    title: "Currency",
    icon: Activity,
    iconClass: "text-violet-400",
    iconBg: "bg-violet-500/15 ring-1 ring-violet-500/30",
    accentClass: "border-violet-500/20",
    subtitleKey: null,
    valueKey: "currency" as const,
    staticSubtitle: "Settlement currency",
  },
];

export function FinanceKPIs() {
  const { data, isLoading } = useFinanceSummary();

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getValue = (stat: typeof STATS[0]) => {
    if (!data) return "—";
    const raw = data[stat.valueKey as keyof typeof data];
    if (stat.valueKey === "currency") return String(raw);
    return formatCurrency(Number(raw));
  };

  const getSubtitle = (stat: typeof STATS[0]) => {
    if (!data) return "Loading…";
    if (stat.staticSubtitle) return stat.staticSubtitle;
    if (stat.subtitleKey === "revenueThisMonth") {
      return `$${(data.revenueThisMonth / 1000).toFixed(1)}k this month`;
    }
    return "";
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
            className={`card-stat hover-lift h-full flex flex-col justify-between border ${stat.accentClass} animate-fade-up`}
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
                  {getSubtitle(stat)}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
