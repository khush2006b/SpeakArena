"use client";

import * as React from "react";
import { PlayCircle, CheckCircle2, ChevronDown, ChevronRight, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWorkspaceStore } from "@/stores/workspace.store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useParams, useRouter } from "next/navigation";
import { useCourseLectures, useCourseProgress } from "@/hooks/queries/useCourseQueries";

export function WorkspaceLeftSidebar() {
  const { isLeftSidebarOpen, isFullscreen, toggleLeftSidebar } = useWorkspaceStore();
  const params = useParams();
  const router = useRouter();
  
  const courseId = params?.courseId as string;
  const currentLessonId = params?.lectureId as string;

  const { data: lectures, isLoading } = useCourseLectures(courseId);
  const { data: progress } = useCourseProgress(courseId);
  
  const modules = React.useMemo(() => {
    if (!lectures || lectures.length === 0) return [];
    
    // Grouping lectures into a single module for UI compatibility
    const allLessons = lectures.map(l => {
      const p = progress?.lectureProgress?.find(lp => lp.lectureId === l.id);
      return {
        id: l.id,
        title: l.title,
        duration: `${Math.floor(l.durationSeconds / 60)}m ${l.durationSeconds % 60}s`,
        isCompleted: p?.isCompleted || false
      };
    }).filter(l => l.title.toLowerCase().includes(searchQuery.toLowerCase()));

    const completedCount = allLessons.filter(l => l.isCompleted).length;
    const moduleProgress = allLessons.length > 0 ? Math.round((completedCount / allLessons.length) * 100) : 0;

    return [{
      id: "mod-1",
      title: "All Lectures",
      progress: moduleProgress,
      lessons: allLessons
    }];
  }, [lectures, progress, searchQuery]);

  // Track expanded modules
  const [expandedModules, setExpandedModules] = React.useState<Record<string, boolean>>({
    "mod-1": true
  });

  const toggleModule = (id: string) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const goToLesson = (id: string) => {
    router.push(`/student/courses/${courseId}/workspace/${id}`);
  };

  if (isFullscreen) return null;

  return (
    <AnimatePresence initial={false}>
      {isLeftSidebarOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="h-full shrink-0 border-r border-border/40 bg-background/50 backdrop-blur-xl flex flex-col z-40 relative overflow-hidden"
        >
          {/* Header */}
          <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border/40">
            <h2 className="font-semibold text-foreground truncate">Course Content</h2>
            <Button variant="ghost" size="icon" onClick={toggleLeftSidebar} className="h-8 w-8 text-muted-foreground md:hidden">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Curriculum Accordion */}
          <ScrollArea className="flex-1 custom-scrollbar">
            <div className="p-2 space-y-1">
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : modules.map((mod) => {
                const isExpanded = expandedModules[mod.id];
                return (
                  <div key={mod.id} className="border border-border/20 rounded-lg overflow-hidden bg-card/50">
                    <button 
                      onClick={() => toggleModule(mod.id)}
                      className="w-full flex flex-col p-3 text-left hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-semibold text-sm text-foreground line-clamp-1 flex-1">{mod.title}</span>
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 w-full">
                        <div className="w-full bg-secondary rounded-full h-1 overflow-hidden">
                          <div className={`h-full ${mod.progress === 100 ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${mod.progress}%` }} />
                        </div>
                        <span className="text-[10px] font-medium text-muted-foreground shrink-0">{mod.progress}%</span>
                      </div>
                    </button>
                    
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "auto" }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col py-1 px-1 bg-secondary/10">
                            {mod.lessons.map((lesson) => {
                              const isCurrent = lesson.id === currentLessonId;
                              return (
                                <button 
                                  key={lesson.id}
                                  onClick={() => goToLesson(lesson.id)}
                                  className={`flex items-start gap-3 p-2 rounded-md text-left transition-colors ${
                                    isCurrent ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-secondary/50"
                                  }`}
                                >
                                  <div className="shrink-0 mt-0.5">
                                    {lesson.isCompleted ? (
                                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    ) : (
                                      <PlayCircle className={`h-4 w-4 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`} />
                                    )}
                                  </div>
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className={`text-sm line-clamp-2 leading-snug ${isCurrent ? 'font-semibold text-primary' : 'font-medium text-foreground/80'}`}>
                                      {lesson.title}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">{lesson.duration}</span>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
