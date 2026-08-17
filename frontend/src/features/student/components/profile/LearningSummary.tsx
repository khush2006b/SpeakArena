"use client";

import * as React from "react";
import { BookOpen, Clock, Flame, Trophy, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { apiClient } from "@/services/api/client";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function LearningSummary() {
  const [stats, setStats] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await apiClient.get('/api/v1/profile');
        const data = res.data?.data || res.data || res;
        setStats({
          coursesEnrolled: data.enrolled_courses_count || 0,
          hoursLearned: data.total_hours_learned || 0,
          longestStreak: data.longest_streak || 0,
          certificatesEarned: data.certificates_count || 0,
        });
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  const STATS = stats ? [
    {
      icon: BookOpen,
      value: stats.coursesEnrolled,
      label: "Courses",
      iconBg: "bg-blue-400/12",
      iconColor: "text-blue-400",
    },
    {
      icon: Clock,
      value: stats.hoursLearned,
      label: "Hours Learned",
      iconBg: "bg-primary/12",
      iconColor: "text-primary",
    },
    {
      icon: Flame,
      value: stats.longestStreak,
      label: "Top Streak",
      iconBg: "bg-amber-400/12",
      iconColor: "text-amber-400",
    },
    {
      icon: Trophy,
      value: stats.certificatesEarned,
      label: "Certificates",
      iconBg: "bg-emerald-500/12",
      iconColor: "text-emerald-400",
    },
  ] : [];

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-foreground font-extrabold text-xl m-0">Learning Summary</h2>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          {STATS.map(({ icon: Icon, value, label, iconBg, iconColor }) => (
            <motion.div key={label} variants={item}>
              <div className="card-stat flex flex-col items-center justify-center text-center h-full hover-lift p-4 rounded-2xl bg-white/[0.02] border border-border/50">
                <div className={`rounded-xl flex items-center justify-center mb-3 p-2 ${iconBg} ${iconColor}`}>
                  <Icon size={20} />
                </div>
                <div className="text-foreground font-extrabold text-2xl mb-1 font-mono">{value}</div>
                <div className="text-muted-foreground text-[11px] font-bold uppercase tracking-widest">{label}</div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
