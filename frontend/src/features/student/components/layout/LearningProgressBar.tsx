"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";

export function LearningProgressBar() {
  const pathname = usePathname();
  
  // Only show this detailed progress bar if the user is inside a specific course context
  // e.g. /student/courses/1/lessons/3
  const isCourseContext = pathname.includes("/courses/") && pathname.includes("/lessons/");
  
  // Mock data for demonstration
  const progress = 65; 
  const currentCourse = "Advanced Frontend Architecture";
  const currentLesson = "Module 3: Server Components";

  if (!isCourseContext) {
    return (
      <div className="fixed top-0 left-0 w-full z-50 h-1" style={{ background: "rgba(255,255,255,0.05)" }}>
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: "25%" }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full"
          style={{ background: "#4f46e5" }}
        />
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 w-full z-50">
      {/* The thin progress bar */}
      <div className="w-full h-1.5" style={{ background: "rgba(255,255,255,0.05)" }}>
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full"
          style={{ background: "#4f46e5" }}
        />
      </div>
      
      {/* Detailed contextual tooltip/bar (optional enhancement) */}
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 backdrop-blur-md shadow-sm rounded-b-xl px-4 py-1.5 flex items-center gap-3"
           style={{ background: "rgba(8,12,20,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderTop: "none" }}>
        <BookOpen className="h-3 w-3" style={{ color: "#4f46e5" }} />
        <span className="text-[10px] font-medium uppercase tracking-wider hidden sm:inline-block" style={{ color: "#6b7280" }}>
          {currentCourse}
        </span>
        <span className="text-[10px] hidden sm:inline-block" style={{ color: "#6b7280" }}>•</span>
        <span className="text-xs font-semibold whitespace-nowrap" style={{ color: "#e5e7eb" }}>
          {currentLesson}
        </span>
        <span className="text-xs font-bold ml-2" style={{ color: "#4f46e5" }}>
          {progress}%
        </span>
      </div>
    </div>
  );
}
