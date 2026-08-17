"use client";

import * as React from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Trophy, CheckCircle2, Video, CreditCard, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { apiClient } from "@/services/api/client";

const TYPE_ICONS = {
  achievement: Trophy,
  course_complete: CheckCircle2,
  live_class: Video,
  course_purchase: CreditCard,
};

export function LearningTimeline() {
  const [timeline, setTimeline] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const res = await apiClient.get('/api/v1/notifications?page=1&page_size=10');
        const data = res.data?.data || res.data || res;
        setTimeline(data.items || data || []);
      } catch (error) {
        setTimeline([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTimeline();
  }, []);

  return (
    <div className="flex flex-col gap-6 mt-12">
      <h2 className="text-foreground font-extrabold text-xl m-0">Recent Activity</h2>

      <div className="card-glass p-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : timeline.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No recent activity.</p>
          </div>
        ) : (
          <div className="relative flex flex-col gap-8">
            {/* Vertical connector line */}
            <div className="absolute top-0 bottom-0 left-[19px] w-0.5 bg-white/[0.06]" />

            {timeline.map((event: any, idx: number) => {
              const Icon = TYPE_ICONS[event.type as keyof typeof TYPE_ICONS] || CheckCircle2;

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="relative flex items-start"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full shrink-0 z-10 bg-card border-4 border-background text-muted-foreground transition-transform duration-200 hover:scale-110">
                    <Icon size={16} />
                  </div>

                  <div className="ml-4 flex-1 pt-1">
                    <h4 className="text-sm font-extrabold text-foreground m-0">{event.title}</h4>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-1 m-0">
                      {formatDistanceToNow(parseISO(event.timestamp || event.created_at || new Date().toISOString()), { addSuffix: true })}
                    </p>
                  </div>
                </motion.div>
              );
            })}

          </div>
        )}
      </div>
    </div>
  );
}
