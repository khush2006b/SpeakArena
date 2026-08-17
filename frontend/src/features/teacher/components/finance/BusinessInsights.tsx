"use client";

import * as React from "react";
import { Sparkles, TrendingUp, AlertTriangle, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

const INSIGHTS = [
  {
    icon: TrendingUp,
    iconClass: "text-emerald-400",
    iconBg: "bg-emerald-500/15",
    text: "Revenue increased 18% this month, driven primarily by 'System Design Masterclass'.",
  },
  {
    icon: ArrowUpRight,
    iconClass: "text-blue-400",
    iconBg: "bg-blue-500/15",
    text: "Course X generated 42% of total lifetime revenue. Consider creating a follow-up cohort.",
  },
  {
    icon: AlertTriangle,
    iconClass: "text-amber-400",
    iconBg: "bg-amber-500/15",
    text: "Payment failures increased by 2% today. Most failures are tied to EU-issued cards.",
  },
];

export function BusinessInsights() {
  return (
    <div className="flex flex-col gap-4 animate-fade-up">
      <div className="flex items-center gap-2 text-violet-400 font-semibold text-sm">
        <Sparkles className="h-4 w-4" />
        Business Intelligence
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {INSIGHTS.map((insight, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="card-glass hover-lift p-4 flex gap-3">
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
