"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { apiClient } from "@/services/api/client";

export function LearningProgressBar() {
  const pathname = usePathname();
  const isCourseContext = pathname.includes("/courses/") && pathname.includes("/lessons/");
  
  const [course, setCourse] = React.useState<any>(null);
  
  React.useEffect(() => {
    async function loadData() {
      try {
        const [, courseRes] = await Promise.allSettled([
          apiClient.get('/api/v1/profile'),
          apiClient.get('/api/v1/courses?enrolled=true&page=1&page_size=1')
        ]);
        
        if (courseRes.status === 'fulfilled') {
          const courses = courseRes.value.data.items || courseRes.value.data.courses || [];
          if (courses.length > 0) {
            setCourse(courses[0]);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadData();
  }, []);

  if (!course) return null;

  const progress = course.progress || 0;
  const currentCourse = course.title || "Course";
  const currentLesson = "Current Lesson";

  if (!isCourseContext) {
    return (
      <div className="fixed top-0 left-0 w-full z-50 h-1 bg-white/5">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full bg-primary"
        />
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 w-full z-50">
      <div className="w-full h-1.5 bg-white/5">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="h-full bg-primary"
        />
      </div>
      
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 backdrop-blur-md shadow-sm rounded-b-xl px-4 py-1.5 flex items-center gap-3 bg-card/90 border border-border border-t-0">
        <BookOpen className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-medium uppercase tracking-wider hidden sm:inline-block text-muted-foreground">
          {currentCourse}
        </span>
        <span className="text-[10px] hidden sm:inline-block text-muted-foreground">•</span>
        <span className="text-xs font-semibold whitespace-nowrap text-foreground">
          {currentLesson}
        </span>
        <span className="text-xs font-bold ml-2 text-primary">
          {progress}%
        </span>
      </div>
    </div>
  );
}
