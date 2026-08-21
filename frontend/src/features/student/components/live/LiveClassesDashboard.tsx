"use client";

import * as React from "react";
import { LiveClassesHeader } from "./LiveClassesHeader";
import { TodaySchedule } from "./TodaySchedule";
import { LiveClassCard } from "./LiveClassCard";
import { PreClassChecklist } from "./PreClassChecklist";
import { RecordingsList } from "./RecordingsList";
import { motion } from "framer-motion";
import { useMeetingList } from "@/hooks/queries/useMeetingQueries";
import { Loader2 } from "lucide-react";

export function LiveClassesDashboard() {
  const [selectedClass, setSelectedClass] = React.useState<any | null>(null);

  const { data, isLoading } = useMeetingList({ page: 1, pageSize: 50 });
  const meetings = data?.items || [];

  const upcomingClasses = meetings.filter(
    (c) => c.status !== "ENDED" && c.status !== "CANCELLED"
  );

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

      <TodaySchedule onJoinClick={setSelectedClass} meetings={meetings} />

      <div className="mt-12">
        <h3 className="text-responsive-lg font-bold text-foreground mb-6">
          Upcoming Classes
        </h3>

        {upcomingClasses.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center card-glass border-dashed">
            <p className="text-sm font-semibold text-foreground">
              No upcoming classes scheduled.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Enjoy your free time!
            </p>
          </div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {upcomingClasses.map((liveClass) => (
              <motion.div key={liveClass.id} variants={item}>
                <LiveClassCard
                  liveClass={liveClass}
                  onJoinClick={setSelectedClass}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <RecordingsList meetings={meetings.filter((m) => m.status === "ENDED")} />

      {/* Join Pre-flight Experience Drawer */}
      <PreClassChecklist
        liveClass={selectedClass}
        isOpen={selectedClass !== null}
        onClose={() => setSelectedClass(null)}
      />
    </div>
  );
}
