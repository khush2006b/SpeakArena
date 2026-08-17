"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { useCurriculumStore } from "@/stores/curriculum.store";
import { useCourseLectures, useCourseProgress } from "@/hooks/queries/useCourseQueries";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CurriculumHeader } from "./CurriculumHeader";
import { CurriculumFilters } from "./CurriculumFilters";
import { CurriculumModule } from "./CurriculumModule";
import { Loader2 } from "lucide-react";

export function CurriculumNavigator() {
  const params = useParams();
  const courseId = params?.courseId as string;
  
  const { isLeftSidebarOpen, isFullscreen } = useWorkspaceStore();
  const { searchQuery, activeFilter, expandAll } = useCurriculumStore();
  
  const { data: lectures, isLoading } = useCourseLectures(courseId);
  const { data: progress } = useCourseProgress(courseId);

  // Map flat lectures to Module -> Section format for UI compatibility
  const courseModules = React.useMemo(() => {
    if (!lectures || lectures.length === 0) return [];
    
    // Create a virtual module & section
    return [{
      id: "mod-1",
      title: "Course Content",
      sections: [{
        id: "sec-1",
        title: "All Lectures",
        lessons: lectures.map(l => {
          const lp = progress?.lectureProgress?.find(p => p.lectureId === l.id);
          return {
            id: l.id,
            title: l.title,
            duration: `${Math.floor(l.durationSeconds / 60)}m ${l.durationSeconds % 60}s`,
            type: l.videoUrl ? "video" : (l.resourceIds.length > 0 ? "pdf" : "text"),
            status: lp?.isCompleted ? "completed" : "not-started",
            isBookmarked: false,
            isDownloaded: false
          };
        })
      }]
    }];
  }, [lectures, progress]);

  // Filter Logic (Derived State)
  const filteredModules = React.useMemo(() => {
    let result = [...courseModules];

    // 1. Filter by Search Query
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.map(mod => {
        const filteredSections = mod.sections.map(sec => ({
          ...sec,
          lessons: sec.lessons.filter(l => l.title.toLowerCase().includes(q))
        })).filter(sec => sec.lessons.length > 0);

        return { ...mod, sections: filteredSections };
      }).filter(mod => mod.sections.length > 0 || mod.title.toLowerCase().includes(q));
      
      expandAll(result.map(m => m.id));
    }

    // 2. Filter by Active Filter Type
    if (activeFilter !== "all") {
      result = result.map(mod => {
        const filteredSections = mod.sections.map(sec => {
          let lessons = sec.lessons;
          switch (activeFilter) {
            case "completed": lessons = lessons.filter(l => l.status === "completed"); break;
            case "incomplete": lessons = lessons.filter(l => l.status !== "completed"); break;
            case "bookmarked": lessons = lessons.filter(l => l.isBookmarked); break;
            case "downloaded": lessons = lessons.filter(l => l.isDownloaded); break;
            case "live": lessons = lessons.filter(l => l.type === "live"); break;
            case "resources": lessons = lessons.filter(l => l.type === "pdf"); break;
          }
          return { ...sec, lessons };
        }).filter(sec => sec.lessons.length > 0);
        
        return { ...mod, sections: filteredSections };
      }).filter(mod => mod.sections.length > 0);
    }

    return result;
  }, [courseModules, searchQuery, activeFilter, expandAll]);

  if (isFullscreen) return null;

  return (
    <AnimatePresence initial={false}>
      {isLeftSidebarOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 340, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="h-full shrink-0 border-r border-border/40 bg-background/50 backdrop-blur-xl flex flex-col z-40 relative overflow-hidden"
        >
          
          <CurriculumHeader />
          <CurriculumFilters />

          <ScrollArea className="flex-1 custom-scrollbar">
            <div className="flex flex-col pb-10">
              
              {isLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                </div>
              ) : filteredModules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-60 px-4">
                  <p className="text-sm font-semibold text-foreground">No lessons found.</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or search query.</p>
                </div>
              ) : (
                filteredModules.map((mod, idx) => (
                  <CurriculumModule 
                    key={mod.id} 
                    module={mod as any} 
                    index={idx + 1} 
                  />
                ))
              )}

            </div>
          </ScrollArea>

        </motion.aside>
      )}
    </AnimatePresence>
  );
}
