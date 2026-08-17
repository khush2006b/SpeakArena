"use client";

import * as React from "react";
import { MessageCircleQuestion, CheckCircle2, Pin, Eye, MessageSquare, Megaphone, Hash } from "lucide-react";
import { useDiscussionStore } from "@/stores/discussion.store";
import { MOCK_DISCUSSION_THREADS, DiscussionThread } from "@/features/student/constants/discussion.mock";

export function DiscussionFeed() {
  const { openThread, searchQuery, activeFilter, activeCategory, selectedTags } = useDiscussionStore();

  // Filter Logic
  const filteredThreads = React.useMemo(() => {
    let result = [...MOCK_DISCUSSION_THREADS];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q) || t.content.toLowerCase().includes(q));
    }

    // Category
    if (activeCategory !== "all") {
      if (activeCategory === "qna") result = result.filter(t => t.type === "question");
      else if (activeCategory === "announcements") result = result.filter(t => t.type === "announcement");
      // else apply other categories
    }

    // Filters
    if (activeFilter === "solved") result = result.filter(t => t.isSolved);
    if (activeFilter === "unanswered") result = result.filter(t => t.replies.length === 0);
    if (activeFilter === "pinned") result = result.filter(t => t.isPinned);
    
    // Tags
    if (selectedTags.length > 0) {
      result = result.filter(t => selectedTags.some(tag => t.tags.includes(tag)));
    }

    return result;
  }, [searchQuery, activeFilter, activeCategory, selectedTags]);

  const getTypeIcon = (type: DiscussionThread['type']) => {
    switch (type) {
      case "question": return <MessageCircleQuestion className="h-5 w-5 text-blue-500" />;
      case "announcement": return <Megaphone className="h-5 w-5 text-rose-500" />;
      case "discussion": return <Hash className="h-5 w-5 text-emerald-500" />;
      default: return <MessageSquare className="h-5 w-5 text-muted-foreground" />;
    }
  };

  if (filteredThreads.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background">
        <div className="h-16 w-16 bg-secondary/50 rounded-full flex items-center justify-center mb-4">
          <MessageSquare className="h-8 w-8 text-muted-foreground opacity-50" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">No discussions found</h3>
        <p className="text-sm text-muted-foreground max-w-sm">Try adjusting your filters, search query, or selected tags to find what you're looking for.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background overflow-y-auto custom-scrollbar flex flex-col relative z-0">
      
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border/40 p-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Discussions</h2>
        <span className="text-xs text-muted-foreground font-mono">{filteredThreads.length} topics</span>
      </div>

      {/* Feed List */}
      <div className="flex flex-col divide-y divide-border/40 pb-10">
        {filteredThreads.map((thread) => (
          <button 
            key={thread.id}
            onClick={() => openThread(thread.id)}
            className="flex flex-col md:flex-row md:items-start gap-4 p-4 hover:bg-secondary/20 transition-colors text-left group relative"
          >
            {/* Left Icons */}
            <div className="hidden md:flex flex-col items-center gap-2 mt-1 shrink-0">
              {getTypeIcon(thread.type)}
              {thread.isSolved && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              
              {/* Meta Top */}
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-xs font-medium text-foreground">{thread.author.name}</span>
                {thread.author.role === "teacher" && (
                  <span className="text-[9px] uppercase tracking-widest bg-blue-500/20 text-blue-500 px-1.5 rounded font-bold">Teacher</span>
                )}
                <span className="text-xs text-muted-foreground">&bull;</span>
                <span className="text-xs text-muted-foreground">{new Date(thread.createdAt).toLocaleDateString()}</span>
                
                {/* Badges */}
                {thread.isPinned && (
                  <div className="ml-auto flex items-center gap-1 text-[10px] text-amber-500 font-medium">
                    <Pin className="h-3 w-3" /> Pinned
                  </div>
                )}
              </div>

              {/* Title */}
              <h3 className="text-base font-semibold text-foreground/90 group-hover:text-primary transition-colors line-clamp-1 mb-2">
                {thread.title}
              </h3>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {thread.tags.map((tag: string) => (
                  <span key={tag} className="text-[10px] bg-secondary/50 text-muted-foreground px-1.5 py-0.5 rounded border border-border/50">
                    {tag}
                  </span>
                ))}
              </div>

            </div>

            {/* Stats Right */}
            <div className="flex items-center gap-4 text-muted-foreground shrink-0 md:mt-2">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="text-xs font-mono">{thread.replies.length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Eye className="h-4 w-4" />
                <span className="text-xs font-mono">{thread.views}</span>
              </div>
            </div>

          </button>
        ))}
      </div>

    </div>
  );
}
