"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStudentStore } from "@/stores/student.store";
import { StudentTable } from "./StudentTable";
import { StudentGrid } from "./StudentGrid";
import { StudentAnalytics } from "./StudentAnalytics";

export function StudentViewContainer() {
  const viewMode = useStudentStore((state) => state.viewMode);

  return (
    <div style={{ position: "relative", minHeight: "500px", width: "100%", background: "hsl(var(--background))" }}>
      <AnimatePresence mode="wait">
        {viewMode === "table" && (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <StudentTable />
          </motion.div>
        )}
        
        {viewMode === "card" && (
          <motion.div
            key="card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <StudentGrid />
          </motion.div>
        )}

        {viewMode === "analytics" && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <StudentAnalytics />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
