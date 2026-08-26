"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { MessageCircleQuestion, Megaphone, Hash, Bookmark, Pin, Radio } from "lucide-react";
import { useDiscussionStore } from "@/stores/discussion.store";
import { DiscussionCategory, DiscussionFilter } from "@/features/student/constants/discussion.mock";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

export function DiscussionLeftPanel() {
  const { 
    isLeftPanelOpen, 
    activeCategory, setActiveCategory,
    activeFilter, setActiveFilter,
    selectedTags, toggleTag
  } = useDiscussionStore();

  if (!isLeftPanelOpen) return null;

  const categories: { id: DiscussionCategory | "all", label: string, icon: React.ReactNode }[] = [
    { id: "all", label: "All Discussions", icon: <Hash className="h-4 w-4" /> },
    { id: "qna", label: "Q&A", icon: <MessageCircleQuestion className="h-4 w-4" /> },
    { id: "announcements", label: "Announcements", icon: <Megaphone className="h-4 w-4" /> },
    { id: "live_class", label: "Live Classes", icon: <Radio className="h-4 w-4" /> },
  ];

  const filters: { id: DiscussionFilter, label: string }[] = [
    { id: "all", label: "Recent" },
    { id: "unanswered", label: "Unanswered" },
    { id: "solved", label: "Solved" },
    { id: "my_questions", label: "My Questions" },
  ];

  const popularTags = ["React 19", "RSC", "Tailwind CSS", "Architecture", "State Management", "Performance"];

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 280, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="h-full shrink-0 border-r border-border/40 bg-background/80 backdrop-blur-xl flex flex-col relative overflow-hidden z-10"
    >

      <ScrollArea className="flex-1 custom-scrollbar">
        <div className="p-3 space-y-6">
          
          {/* Categories */}
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 mb-2">
              Categories
            </div>
            <div className="flex flex-col gap-1">
              {categories.map((cat) => (
                <button 
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeCategory === cat.id ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-secondary/50 hover:text-foreground"
                  }`}
                >
                  {cat.icon}
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 mb-2">
              Filters
            </div>
            <div className="flex flex-col gap-1">
              {filters.map((f) => (
                <button 
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeFilter === f.id ? "text-primary" : "text-foreground/80 hover:text-foreground hover:bg-secondary/30"
                  }`}
                >
                  {f.label}
                  {activeFilter === f.id && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 mb-2">
              Quick Links
            </div>
            <div className="flex flex-col gap-1">
              <button className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium text-foreground/80 hover:bg-secondary/50 hover:text-foreground transition-colors">
                <Bookmark className="h-4 w-4" /> Saved Discussions
              </button>
              <button className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium text-foreground/80 hover:bg-secondary/50 hover:text-foreground transition-colors">
                <Pin className="h-4 w-4" /> Pinned by Teachers
              </button>
            </div>
          </div>

          {/* Popular Tags */}
          <div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 mb-2">
              Popular Tags
            </div>
            <div className="flex flex-wrap gap-1.5 px-1">
              {popularTags.map((tag) => (
                <button 
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`text-[10px] font-medium px-2 py-1 rounded-full border transition-colors ${
                    selectedTags.includes(tag) 
                      ? "bg-primary/20 border-primary/50 text-primary" 
                      : "bg-secondary/50 border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

        </div>
      </ScrollArea>
      
      {/* New Discussion Action */}
      <div className="p-4 border-t border-border/40 shrink-0">
        <Button className="w-full">
          New Discussion
        </Button>
      </div>

    </motion.aside>
  );
}
