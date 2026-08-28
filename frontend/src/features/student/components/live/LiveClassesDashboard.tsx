"use client";

import * as React from "react";
import { LiveClassesHeader } from "./LiveClassesHeader";
import { TodaySchedule } from "./TodaySchedule";
import { LiveClassCard } from "./LiveClassCard";
import { RecordingsList } from "./RecordingsList";
import { motion } from "framer-motion";
import { useMeetingList, useJoinMeeting } from "@/hooks/queries/useMeetingQueries";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getMeetingStatus } from "@/lib/utils";

export function LiveClassesDashboard() {
  const [nowMs, setNowMs] = React.useState<number>(Date.now());

  const { data, isLoading } = useMeetingList({ page: 1, pageSize: 50 });
  const meetings = data?.items || [];
  const joinMutation = useJoinMeeting();

  const handleJoinClass = (liveClass: any) => {
    if (!liveClass?.id) return;
    toast.info("Connecting to live class...");
    joinMutation.mutate(liveClass.id, {
      onSuccess: () => {
        toast.success("Joining Google Meet...");
      },
      onError: (err: any) => {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Could not join meeting. Please verify class schedule.";
        toast.error(msg);
      },
    });
  };

  // Real-time 5s ticker interval for status transitions
  React.useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Sort classes: LIVE first, then UPCOMING (earliest start), then ENDED (latest start)
  const sortedClasses = [...meetings].sort((a, b) => {
    const stA = getMeetingStatus(a, nowMs);
    const stB = getMeetingStatus(b, nowMs);
    const order: Record<string, number> = { LIVE: 0, UPCOMING: 1, ENDED: 2, CANCELLED: 3 };
    if (order[stA] !== order[stB]) {
      return order[stA] - order[stB];
    }
    const timeA = new Date(a.scheduledAt || a.scheduled_at || 0).getTime();
    const timeB = new Date(b.scheduledAt || b.scheduled_at || 0).getTime();
    return stA === "ENDED" ? timeB - timeA : timeA - timeB;
  });

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 24 },
    },
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex justify-center items-center h-full min-h-[500px] bg-background">
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-up pb-20 bg-background min-h-screen">
      <LiveClassesHeader />

      <TodaySchedule onJoinClick={handleJoinClass} meetings={meetings} />

      <div className="mt-12">
        <h3 className="text-responsive-lg font-bold text-foreground mb-6">
          Live & Scheduled Classes
        </h3>

        {sortedClasses.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center card-glass border-dashed">
            <p className="text-sm font-semibold text-foreground">
              No classes scheduled yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Check back soon for new sessions!
            </p>
          </div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {sortedClasses.map((liveClass) => (
              <motion.div key={liveClass.id} variants={item}>
                <LiveClassCard
                  liveClass={liveClass}
                  onJoinClick={handleJoinClass}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <RecordingsList
        meetings={meetings.filter((m) => getMeetingStatus(m, nowMs) === "ENDED")}
      />
    </div>
  );
}
