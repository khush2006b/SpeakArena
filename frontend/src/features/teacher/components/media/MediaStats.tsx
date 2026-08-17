"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Database, Video, FileText, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const STATS = [
  {
    title: "Storage Used",
    value: "24.5 GB",
    subtitle: "of 100 GB limit",
    icon: Database,
    iconClass: "text-violet-400",
    iconBg: "bg-violet-500/15 ring-1 ring-violet-500/30",
    glowClass: "bg-violet-500/20",
    progress: 24.5,
    progressClass: "bg-violet-500",
  },
  {
    title: "Videos",
    value: "142",
    subtitle: "Total uploaded",
    icon: Video,
    iconClass: "text-blue-400",
    iconBg: "bg-blue-500/15 ring-1 ring-blue-500/30",
    glowClass: "bg-blue-500/20",
  },
  {
    title: "PDFs & Docs",
    value: "86",
    subtitle: "Total uploaded",
    icon: FileText,
    iconClass: "text-orange-400",
    iconBg: "bg-orange-500/15 ring-1 ring-orange-500/30",
    glowClass: "bg-orange-500/20",
  },
  {
    title: "Processing",
    value: "3",
    subtitle: "Files converting",
    icon: Loader2,
    iconClass: "text-emerald-400",
    iconBg: "bg-emerald-500/15 ring-1 ring-emerald-500/30",
    glowClass: "bg-emerald-500/20",
    spin: true,
  },
  {
    title: "Failed",
    value: "1",
    subtitle: "Upload errors",
    icon: AlertCircle,
    iconClass: "text-red-400",
    iconBg: "bg-red-500/15 ring-1 ring-red-500/30",
    glowClass: "bg-red-500/20",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export function MediaStats() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5 mb-8"
    >
      {STATS.map((stat) => (
        <motion.div key={stat.title} variants={itemVariants}>
          <div className="card-stat hover-lift h-full flex flex-col justify-between overflow-hidden relative group">
            <div className={cn("absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity", stat.glowClass)} />
            <div className="flex flex-col gap-4 relative z-10">
              <div className="flex items-start justify-between">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 shrink-0", stat.iconBg)}>
                  <stat.icon className={cn("h-5 w-5", stat.iconClass, stat.spin && "animate-spin")} />
                </div>
                <h2 className="text-2xl font-extrabold tracking-tight text-foreground mt-1">{stat.value}</h2>
              </div>
              <div>
                <p className="text-sm font-bold tracking-tight text-foreground">{stat.title}</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 mt-1">{stat.subtitle}</p>
              </div>
            </div>

            {stat.progress !== undefined && (
              <div className="mt-5 relative z-10">
                <div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-1000", stat.progressClass)}
                    style={{ width: `${stat.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
