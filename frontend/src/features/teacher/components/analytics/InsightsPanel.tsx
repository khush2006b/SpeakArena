"use client";

import * as React from "react";
import { Sparkles, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const INSIGHTS = [
  {
    icon: TrendingDown,
    color: "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]",
    bgColor: "bg-red-500/10 ring-1 ring-red-500/30",
    text: "Attendance dropped 12% this week in System Design Masterclass.",
  },
  {
    icon: AlertTriangle,
    color: "text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]",
    bgColor: "bg-orange-500/10 ring-1 ring-orange-500/30",
    text: "Sarah Chen has missed 4 consecutive sessions. She is flagged as high risk.",
  },
  {
    icon: TrendingUp,
    color: "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]",
    bgColor: "bg-emerald-500/10 ring-1 ring-emerald-500/30",
    text: "Average watch time increased by 45 mins this month. High engagement detected.",
  }
];

export function InsightsPanel() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[hsl(270,80%,60%)] font-bold text-sm tracking-wide">
        <Sparkles className="h-4 w-4 drop-shadow-[0_0_8px_hsla(270,80%,60%,0.8)]" />
        <span className="bg-gradient-to-r from-[hsl(270,80%,60%)] to-[hsla(270,80%,60%,0.5)] bg-clip-text text-transparent">AI Insights</span>
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {INSIGHTS.map((insight, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="h-full"
          >
            <div className="card-glass hover-lift rounded-2xl bg-card border border-border overflow-hidden transition-all duration-300 h-full relative group">
              <div className={cn("absolute -top-4 -right-4 w-16 h-16 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none", insight.bgColor)} />
              <div className="p-5 flex gap-4 relative z-10 h-full items-start">
                <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${insight.bgColor}`}>
                  <insight.icon className={`h-[18px] w-[18px] ${insight.color}`} />
                </div>
                <p className="text-sm font-semibold leading-relaxed text-muted-foreground group-hover:text-foreground transition-colors pt-1 m-0">
                  {insight.text}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
