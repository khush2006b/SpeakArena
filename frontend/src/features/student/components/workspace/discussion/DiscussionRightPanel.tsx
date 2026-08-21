"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { FileText, PlayCircle, BookOpen, AlertCircle } from "lucide-react";
import { useDiscussionStore } from "@/stores/discussion.store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MOCK_DISCUSSION_THREADS, DiscussionThread } from "@/features/student/constants/discussion.mock";

export function DiscussionRightPanel() {
  const { isRightPanelOpen, activeThreadId } = useDiscussionStore();

  if (!isRightPanelOpen) return null;

  const activeThread = activeThreadId 
    ? MOCK_DISCUSSION_THREADS.find((t: DiscussionThread) => t.id === activeThreadId)
    : null;

  const onlineParticipants = [
    { id: "t-1", name: "Paras (Construction)", role: "teacher", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=Sarah" },
    { id: "u-1", name: "Alex Johnson", role: "student", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=Alex" },
    { id: "u-3", name: "Emily Davis", role: "student", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=Emily" },
  ];

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 280, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="h-full shrink-0 border-l border-border/40 bg-background/80 backdrop-blur-xl flex flex-col relative overflow-hidden z-10"
    >
      <ScrollArea className="flex-1 custom-scrollbar">
        <div className="p-4 space-y-6">
          
          {/* Thread Context (Only visible when viewing a thread) */}
          {activeThread && activeThread.relatedLessonId && (
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Related Context
              </div>
              <div className="bg-secondary/50 rounded-lg p-3 border border-border/50 hover:border-primary/30 transition-colors cursor-pointer group">
                <div className="flex items-center gap-2 mb-1">
                  <PlayCircle className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">Lesson Material</span>
                </div>
                <p className="text-sm text-foreground/80 line-clamp-2">
                  {activeThread.relatedLessonTitle}
                </p>
              </div>
            </div>
          )}

          {/* Teacher Guidelines */}
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Teacher Guidelines
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-200/80 leading-relaxed">
                Before posting a new question, please search the forum to see if it has already been answered. Ensure you tag your questions correctly!
              </p>
            </div>
          </div>

          {/* Online Participants */}
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Online Now</span>
              <span className="bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded-full">3</span>
            </div>
            <div className="flex flex-col gap-3">
              {onlineParticipants.map(p => (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="relative">
                    <img src={p.avatar} alt={p.name} className="h-8 w-8 rounded-full bg-secondary border border-border/50" />
                    <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{p.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pinned Resources */}
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Pinned Resources
            </div>
            <div className="flex flex-col gap-2">
              <button className="flex items-center gap-2 p-2 rounded-md hover:bg-secondary/50 text-left group">
                <BookOpen className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-foreground/80 group-hover:text-foreground">Course Syllabus & Rules</span>
              </button>
              <button className="flex items-center gap-2 p-2 rounded-md hover:bg-secondary/50 text-left group">
                <FileText className="h-4 w-4 text-rose-500 shrink-0" />
                <span className="text-sm text-foreground/80 group-hover:text-foreground">React Cheatsheet (PDF)</span>
              </button>
            </div>
          </div>

        </div>
      </ScrollArea>
    </motion.aside>
  );
}
