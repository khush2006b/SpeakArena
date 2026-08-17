"use client";

import * as React from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  Video,
  FileText,
  CalendarCheck,
  Trophy,
  CreditCard,
  Bookmark,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { apiClient } from "@/services/api/client";

const ACTIVITY_ICONS: Record<string, any> = {
  lesson_completed: CheckCircle2,
  video_watched: Video,
  pdf_read: FileText,
  live_class_joined: CalendarCheck,
  achievement_earned: Trophy,
  course_purchased: CreditCard,
  bookmark_added: Bookmark,
};

export function ActivityTimeline() {
  const [activities, setActivities] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await apiClient.get('/api/v1/notifications?page=1&page_size=20');
        setActivities(res.data?.items ?? res.data?.data ?? res.data ?? []);
      } catch (error) {
        setActivities([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchActivities();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-background border-l border-border/50 animate-fade-up">
      <div className="shrink-0 p-6 border-b border-border/50">
        <h2 className="text-xl font-extrabold text-foreground">
          Activity Timeline
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Your recent learning milestones and actions.
        </p>
      </div>

      <ScrollArea className="flex-1 p-6">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No activity recorded yet.</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto flex flex-col gap-8 relative">
            {/* Vertical Line */}
            <div className="absolute top-0 bottom-0 left-[23px] w-0.5 bg-border/50" />

            {activities.map((activity, idx) => {
              const Icon = ACTIVITY_ICONS[activity.type] || CheckCircle2;

              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="relative flex items-start hover-lift"
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-full border border-border/50 bg-card/60 backdrop-blur shrink-0 z-10 text-muted-foreground transition-all duration-200 hover:border-primary/50 hover:text-primary">
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="ml-4 flex-1 pt-1.5">
                    <h4 className="text-sm font-bold text-foreground">
                      {activity.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(parseISO(activity.timestamp || activity.created_at || new Date().toISOString()), {
                        addSuffix: true,
                      })}
                    </p>
                    {activity.courseTitle && (
                      <span className="inline-block text-xs font-medium text-muted-foreground mt-2 bg-card/60 backdrop-blur px-2 py-1 rounded border border-border/50">
                        {activity.courseTitle}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
