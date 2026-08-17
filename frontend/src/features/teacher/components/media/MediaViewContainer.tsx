"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMediaStore } from "@/stores/media.store";
import { MediaGrid } from "./MediaGrid";
import { MediaList } from "./MediaList";

export function MediaViewContainer() {
  const viewMode = useMediaStore((state) => state.viewMode);

  return (
    <div className="relative min-h-[500px] w-full bg-background">
      <AnimatePresence mode="wait">
        {viewMode === "grid" || viewMode === "gallery" ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <MediaGrid />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <MediaList />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
