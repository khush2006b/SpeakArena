"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Sparkles, TrendingUp, Info } from "lucide-react";
import { motion } from "framer-motion";
import { apiClient } from "@/services/api/client";
import { Skeleton } from "@/components/ui/skeleton";

export function PersonalInsights() {
  const [insights, setInsights] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadData() {
      try {
        const res = await apiClient.get('/api/v1/profile');
        const response = res.data;
        const generatedInsights = [];
        
        if (response.streak_days > 0) {
          generatedInsights.push({ id: 1, type: "positive", text: `You are on a ${response.streak_days} day streak! Keep it up!` });
        }
        if (response.total_hours > 0) {
          generatedInsights.push({ id: 2, type: "neutral", text: `You have spent ${response.total_hours} hours learning.` });
        }
        if (response.total_courses_completed > 0) {
          generatedInsights.push({ id: 3, type: "positive", text: `Great job completing ${response.total_courses_completed} courses!` });
        }
        setInsights(generatedInsights);
      } catch (error) {
        console.error("Failed to load insights", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case "positive": return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case "neutral": return <Info className="h-4 w-4 text-blue-500" />;
      default: return <Sparkles className="h-4 w-4 text-primary" />;
    }
  };

  if (loading) {
    return <Skeleton className="h-[200px] w-full rounded-[18px]" />;
  }

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const item = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <Card className="p-6 bg-card border-border rounded-[18px] flex flex-col h-full">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider m-0">AI Insights</h3>
      </div>
      
      {insights.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Complete your first course to unlock insights
        </div>
      ) : (
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-3 flex-1 justify-center"
        >
          {insights.map((insight) => (
            <motion.div key={insight.id} variants={item}>
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex items-start gap-3 transition-colors">
                <div className="mt-0.5 shrink-0">
                  {getIcon(insight.type)}
                </div>
                <p className="text-sm text-muted-foreground m-0 leading-relaxed">
                  {insight.text}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </Card>
  );
}
