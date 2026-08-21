"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { DollarSign, BookOpen, Crown, Calendar, Loader2 } from "lucide-react";
import { apiClient } from "@/services/api/client";
import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function PurchaseSummary() {
  const [summary, setSummary] = React.useState({
    totalSpent: 0,
    activeCourses: 0,
    lifetimeValue: 0,
    recentPurchaseDate: new Date().toISOString()
  });
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchPayments = async () => {
      try {
        const response = await apiClient.get("/api/v1/payments/history?page=1&page_size=100");
        const payments = response.data?.items || [];
        
        let totalSpent = 0;
        let recentDate = new Date().toISOString();
        if (payments.length > 0) {
          recentDate = payments[0].created_at || new Date().toISOString();
          payments.forEach((p: any) => {
            totalSpent += (p.amount || 0);
          });
        }
        
        setSummary({
          totalSpent,
          activeCourses: payments.length,
          lifetimeValue: totalSpent,
          recentPurchaseDate: recentDate
        });
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };
    fetchPayments();
  }, []);

  const SUMMARY_CARDS = [
    {
      icon: DollarSign,
      label: "Total Spent",
      value: `₹${summary.totalSpent.toFixed(2)}`,
      iconBg: "bg-emerald-500/15",
      iconBorder: "border-emerald-500/25",
      iconColor: "text-emerald-400",
    },
    {
      icon: BookOpen,
      label: "Active Courses",
      value: String(summary.activeCourses),
      iconBg: "bg-blue-500/15",
      iconBorder: "border-blue-500/25",
      iconColor: "text-blue-400",
    },
    {
      icon: Crown,
      label: "Lifetime Value",
      value: `₹${summary.lifetimeValue.toFixed(2)}`,
      iconBg: "bg-amber-500/15",
      iconBorder: "border-amber-500/25",
      iconColor: "text-amber-400",
    },
    {
      icon: Calendar,
      label: "Last Purchase",
      value: format(parseISO(summary.recentPurchaseDate), "MMM d, yyyy"),
      iconBg: "bg-purple-500/15",
      iconBorder: "border-purple-500/25",
      iconColor: "text-purple-400",
      smallValue: true,
    },
  ];

  if (isLoading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-60" />
      </div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
    >
      {SUMMARY_CARDS.map(({ icon: Icon, label, value, iconBg, iconBorder, iconColor, smallValue }) => (
        <motion.div key={label} variants={item}>
          <div className="card-glass p-5 rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl hover-lift cursor-default group transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl ${iconBg} border ${iconBorder} flex items-center justify-center ${iconColor} shrink-0 shadow-sm`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest m-0 truncate">{label}</p>
                <h3 className={`font-extrabold text-foreground m-0 mt-1 truncate ${smallValue ? "text-sm" : "text-2xl tracking-tight"}`}>
                  {value}
                </h3>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
