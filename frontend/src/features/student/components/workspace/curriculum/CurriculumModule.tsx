"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Module, Section, Lesson } from "@/features/student/constants/curriculum.mock";
import { useCurriculumStore } from "@/stores/curriculum.store";
import { CurriculumLesson } from "./CurriculumLesson";

interface CurriculumModuleProps {
  module: Module;
  index: number;
}

export const CurriculumModule = React.memo(function CurriculumModule({ module, index }: CurriculumModuleProps) {
  const { expandedModules, toggleModule } = useCurriculumStore();
  const isExpanded = !!expandedModules[module.id];

  const totalLessons = module.sections.reduce((acc: number, sec: Section) => acc + sec.lessons.length, 0);

  return (
    <div className="border-b border-border/40 last:border-0 bg-background/30">
      
      {/* Module Header (Accordion Trigger) */}
      <button 
        onClick={() => toggleModule(module.id)}
        className="w-full flex flex-col p-4 text-left hover:bg-secondary/30 transition-colors group"
      >
        <div className="flex items-start justify-between w-full mb-2 gap-4">
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Module {index}
            </span>
            <span className="font-semibold text-sm text-foreground leading-tight group-hover:text-primary transition-colors">
              {module.title}
            </span>
          </div>
          <div className="shrink-0 mt-1 bg-secondary/50 p-1 rounded">
            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
        
        {/* Module Meta Info */}
        <div className="flex items-center justify-between w-full text-[10px] font-medium text-muted-foreground mb-2">
          <span>{totalLessons} Lessons</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {module.estimatedDuration}</span>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 bg-secondary rounded-full h-1 overflow-hidden">
            <div 
              className={`h-full ${module.progress === 100 ? 'bg-emerald-500' : 'bg-primary'}`} 
              style={{ width: `${module.progress}%` }} 
            />
          </div>
          <span className={`text-[10px] font-bold ${module.progress === 100 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
            {module.progress}%
          </span>
        </div>
      </button>
      
      {/* Expanded Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden bg-secondary/10"
          >
            <div className="flex flex-col pb-3 pt-1 px-2 space-y-4">
              
              {module.sections.map((section: Section) => (
                <div key={section.id} className="flex flex-col">
                  {/* Section Header (Optional, if multiple sections exist) */}
                  {module.sections.length > 1 && (
                    <div className="px-3 py-1.5 mb-1 text-[10px] font-bold text-foreground/50 uppercase tracking-widest border-b border-border/30">
                      {section.title}
                    </div>
                  )}
                  
                  {/* Lessons in Section */}
                  <div className="flex flex-col gap-0.5">
                    {section.lessons.map((lesson: Lesson, lIdx: number) => (
                      <CurriculumLesson 
                        key={lesson.id} 
                        lesson={lesson} 
                        index={lIdx + 1} 
                      />
                    ))}
                  </div>
                </div>
              ))}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
