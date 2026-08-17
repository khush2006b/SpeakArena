"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, MessageSquare, StickyNote, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileWorkspaceToolbarProps {
  onOpenCurriculum: () => void;
  onOpenNotes: () => void;
  onOpenDiscussion: () => void;
}

export function MobileWorkspaceToolbar({
  onOpenCurriculum,
  onOpenNotes,
  onOpenDiscussion,
}: MobileWorkspaceToolbarProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const actions = [
    {
      label: "Curriculum",
      icon: <BookOpen className="h-5 w-5" />,
      onClick: () => { onOpenCurriculum(); setIsExpanded(false); },
      color: "bg-primary text-primary-foreground shadow-primary/25",
    },
    {
      label: "Notes",
      icon: <StickyNote className="h-5 w-5" />,
      onClick: () => { onOpenNotes(); setIsExpanded(false); },
      color: "bg-emerald-600 text-white shadow-emerald-500/25",
    },
    {
      label: "Discussion",
      icon: <MessageSquare className="h-5 w-5" />,
      onClick: () => { onOpenDiscussion(); setIsExpanded(false); },
      color: "bg-violet-600 text-white shadow-violet-500/25",
    },
  ];

  return (
    <>
      {/* Click-away overlay when expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            key="fab-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 md:hidden"
            onClick={() => setIsExpanded(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* FAB group */}
      <div
        className="fixed bottom-20 right-4 z-50 md:hidden flex flex-col items-end gap-3"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Workspace quick actions"
      >
        {/* Expandable actions */}
        <AnimatePresence>
          {isExpanded &&
            actions.map((action, i) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 28,
                  delay: i * 0.05,
                }}
                className="flex items-center gap-2"
              >
                {/* Label */}
                <span className="text-xs font-semibold bg-background/90 backdrop-blur-md border border-border/50 rounded-full px-2.5 py-1 shadow text-foreground whitespace-nowrap">
                  {action.label}
                </span>
                {/* Button */}
                <button
                  onClick={action.onClick}
                  className={cn(
                    "h-11 w-11 rounded-full flex items-center justify-center shadow-lg",
                    "active:scale-90 transition-transform touch-manipulation",
                    action.color
                  )}
                  aria-label={action.label}
                >
                  {action.icon}
                </button>
              </motion.div>
            ))}
        </AnimatePresence>

        {/* Main FAB trigger */}
        <motion.button
          onClick={() => setIsExpanded((v) => !v)}
          animate={{ rotate: isExpanded ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className={cn(
            "h-14 w-14 rounded-full flex items-center justify-center shadow-xl",
            "bg-primary text-primary-foreground shadow-primary/30",
            "active:scale-90 transition-transform touch-manipulation"
          )}
          aria-label={isExpanded ? "Close actions" : "Open workspace actions"}
          aria-expanded={isExpanded}
        >
          <MoreVertical className="h-6 w-6" />
        </motion.button>
      </div>
    </>
  );
}
