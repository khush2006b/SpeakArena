"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Clock, BookOpen, Flame, Award } from "lucide-react";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/services/api/client";
import { Skeleton } from "@/components/ui/skeleton";

export function AnalyticsSummary() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadData() {
      try {
        const response = await apiClient.get('/api/v1/profile');
        setData(response.data);
      } catch (error) {
        console.error("Failed to load profile", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading || !data) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[120px] rounded-[18px]" />)}
      </div>
    );
  }

  const cards = [
    { title: "Hours Studied", value: data.total_hours || 0, icon: <Clock className="h-5 w-5 text-primary" />, suffix: "h" },
    { title: "Current Streak", value: data.streak_days || 0, icon: <Flame className="h-5 w-5 text-primary" />, suffix: " days" },
    { title: "Courses Enrolled", value: data.total_courses_enrolled || 0, icon: <BookOpen className="h-5 w-5 text-primary" /> },
    { title: "Courses Completed", value: data.total_courses_completed || 0, icon: <Award className="h-5 w-5 text-primary" /> },
  ];

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

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}
    >
      {cards.map((card, i) => (
        <motion.div key={i} variants={item}>
          <Card className="p-4 flex flex-col h-full bg-card border-border rounded-[18px]">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <div className="rounded-[10px] p-2 bg-primary/10 flex items-center justify-center">
                {card.icon}
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider">{card.title}</span>
            </div>
            <div className="mt-auto">
              <span className="text-[28px] font-extrabold text-foreground">
                {card.value}
              </span>
              {card.suffix && (
                <span className="text-sm font-medium text-muted-foreground ml-1">{card.suffix}</span>
              )}
            </div>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}
