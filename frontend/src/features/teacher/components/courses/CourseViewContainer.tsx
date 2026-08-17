"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/stores/ui.store";
import { CourseGrid } from "./CourseGrid";
import { CourseList } from "./CourseList";

export function CourseViewContainer() {
  const viewType = useUIStore((state) => state.courseViewType);
  const search = useUIStore((state) => state.courseSearch);
  const status = useUIStore((state) => state.courseStatusFilter);

  const formattedStatus = status === "all" ? undefined : status.toUpperCase();

  return (
    <div style={{ position: 'relative', minHeight: '500px', width: '100%', background: "hsl(var(--background))" }}>
      <AnimatePresence mode="wait">
        {viewType === "grid" ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <CourseGrid {...(search ? { search } : {})} {...(formattedStatus ? { status: formattedStatus } : {})} />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <CourseList {...(search ? { search } : {})} {...(formattedStatus ? { status: formattedStatus } : {})} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
