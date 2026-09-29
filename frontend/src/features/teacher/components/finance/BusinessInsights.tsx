"use client";

import * as React from "react";
import { Sparkles, TrendingUp, ShieldCheck, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { useFinanceSummary, useTeacherKPIs } from "@/hooks/queries/useTeacherQueries";
import { useFinanceStore } from "@/stores/finance.store";

export function BusinessInsights() {
  const { dateRange, currency: storeCurrency } = useFinanceStore();
  const { data: summary } = useFinanceSummary(dateRange, storeCurrency);
  const { data: kpis } = useTeacherKPIs();

  const symbol = storeCurrency === "USD" ? "$" : "₹";
  const totalRev = summary?.totalRevenue || 0;
  const monthRev = summary?.revenueThisMonth || 0;
  const totalTx = summary?.totalTransactions || 0;
  const activeStudents = kpis?.totalStudents || 0;

  const insights = React.useMemo(() => {
    return [
      {
        icon: TrendingUp,
        iconClass: "text-emerald-400",
        iconBg: "bg-emerald-500/15",
        text: monthRev > 0
          ? `Generated ${symbol}${monthRev.toLocaleString()} in verified sales this month across active student enrollments.`
          : `Active courses are live in the catalog. New student enrollments will automatically reflect here.`,
      },
      {
        icon: ArrowUpRight,
        iconClass: "text-blue-400",
        iconBg: "bg-blue-500/15",
        text: totalRev > 0
          ? `Cumulative earnings reached ${symbol}${totalRev.toLocaleString()} with ${totalTx} total transactions processed.`
          : `Published courses are ready to accept payments via Razorpay (UPI, Cards, NetBanking).`,
      },
      {
        icon: ShieldCheck,
        iconClass: "text-violet-400",
        iconBg: "bg-violet-500/15",
        text: `100% of captured transactions are cryptographically verified with Razorpay HMAC signatures.`,
      },
    ];
  }, [totalRev, monthRev, totalTx, symbol]);

  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <div className="flex items-center gap-2 text-violet-400 font-semibold text-sm">
        <Sparkles className="h-4 w-4" />
        Business Intelligence &amp; Overview
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {insights.map((insight, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="card-glass hover-lift p-4 flex gap-3 h-full">
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${insight.iconBg}`}
              >
                <insight.icon className={`h-4 w-4 ${insight.iconClass}`} />
              </div>
              <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                {insight.text}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
