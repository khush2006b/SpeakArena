"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useCurriculumStore } from "@/stores/curriculum.store";
import { CurriculumFilters } from "@/features/student/components/workspace/curriculum/CurriculumFilters";
import { CurriculumModule } from "@/features/student/components/workspace/curriculum/CurriculumModule";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCourseLectures, useCourseProgress } from "@/hooks/queries/useCourseQueries";

interface MobileCurriculumDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileCurriculumDrawer({ isOpen, onClose }: MobileCurriculumDrawerProps) {
  const params = useParams();
  const courseId = params?.courseId as string;
  const { searchQuery, activeFilter, expandAll } = useCurriculumStore();
  
  const { data: lectures, isLoading } = useCourseLectures(courseId);
  const { data: progress } = useCourseProgress(courseId);

  // Map flat lectures to Module -> Section format for UI compatibility
  const courseModules = React.useMemo(() => {
    if (!lectures || lectures.length === 0) return [];
    
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

  // Filtered modules — same logic as CurriculumNavigator but used in bottom sheet
  const filteredModules = React.useMemo(() => {
    let result = [...courseModules];

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result
        .map((mod: any) => {
          const filteredSections = mod.sections
            .map((sec: any) => ({
              ...sec,
              lessons: sec.lessons.filter((l: any) =>
                l.title.toLowerCase().includes(q)
              ),
            }))
            .filter((sec: any) => sec.lessons.length > 0);
          return { ...mod, sections: filteredSections };
        })
        .filter(
          (mod: any) =>
            mod.sections.length > 0 || mod.title.toLowerCase().includes(q)
        );

      expandAll(result.map((m: any) => m.id));
    }

    if (activeFilter !== "all") {
      result = result
        .map((mod: any) => {
          const filteredSections = mod.sections
            .map((sec: any) => {
              let lessons = sec.lessons;
              switch (activeFilter) {
                case "completed":
                  lessons = lessons.filter((l: any) => l.status === "completed");
                  break;
                case "incomplete":
                  lessons = lessons.filter((l: any) => l.status !== "completed");
                  break;
                case "bookmarked":
                  lessons = lessons.filter((l: any) => l.isBookmarked);
                  break;
                case "downloaded":
                  lessons = lessons.filter((l: any) => l.isDownloaded);
                  break;
                case "live":
                  lessons = lessons.filter((l: any) => l.type === "live");
                  break;
                case "resources":
                  lessons = lessons.filter((l: any) => l.type === "pdf");
                  break;
              }
              return { ...sec, lessons };
            })
            .filter((sec: any) => sec.lessons.length > 0);
          return { ...mod, sections: filteredSections };
        })
        .filter((mod: any) => mod.sections.length > 0);
    }

    return result;
  }, [courseModules, searchQuery, activeFilter, expandAll]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Bottom Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex flex-col bg-background rounded-t-2xl shadow-2xl border-t border-border/50"
            style={{
              maxHeight: "82vh",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 80 || info.velocity.y > 400) {
                onClose();
              }
            }}
          >
            {/* Drag handle */}
            <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 shrink-0">
              <h2 className="text-base font-bold">Course Curriculum</h2>
              <button
                onClick={onClose}
                className="flex items-center justify-center h-8 w-8 rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close curriculum"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <CurriculumFilters />

            {/* Lessons list */}
            <ScrollArea className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="flex flex-col pb-6">
                {isLoading ? (
                  <div className="flex justify-center py-20">
                    <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                  </div>
                ) : filteredModules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center opacity-60 px-4">
                    <p className="text-sm font-semibold text-foreground">
                      No lessons found.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Adjust your filters or search query.
                    </p>
                  </div>
                ) : (
                  filteredModules.map((mod: any, idx: number) => (
                    <CurriculumModule
                      key={mod.id}
                      module={mod}
                      index={idx + 1}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
