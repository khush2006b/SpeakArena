"use client";

import * as React from "react";
import { ArrowLeft, CheckCircle2, Lock, MoreHorizontal, MessageSquare, ThumbsUp } from "lucide-react";
import { useDiscussionStore } from "@/stores/discussion.store";
import { MOCK_DISCUSSION_THREADS, Reply, DiscussionThread as ThreadType } from "@/features/student/constants/discussion.mock";
import { Button } from "@/components/ui/button";
import { RichTextComposer } from "./RichTextComposer";

export function DiscussionThread() {
  const { activeThreadId, closeThread } = useDiscussionStore();

  const thread = activeThreadId 
    ? MOCK_DISCUSSION_THREADS.find((t: ThreadType) => t.id === activeThreadId)
    : null;

  if (!thread) return null;

  const handleReply = (html: string) => {
    // In a real app, this would dispatch a mutation.
    console.log("New reply submitted:", html);
  };

  const renderReply = (reply: Reply, isNested = false) => {
    return (
      <div key={reply.id} className={`flex gap-4 ${isNested ? "mt-4 ml-8 md:ml-12 border-l-2 border-border/50 pl-4" : "p-4 border-b border-border/40"}`}>
        
        {/* Avatar */}
        <div className="shrink-0 mt-1">
          <img src={reply.author.avatar} alt={reply.author.name} className="h-8 w-8 rounded-full bg-secondary border border-border/50" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{reply.author.name}</span>
            {reply.author.role === "teacher" && (
              <span className="text-[10px] uppercase tracking-widest bg-blue-500/20 text-blue-500 px-1.5 rounded font-bold">Verified Teacher</span>
            )}
            <span className="text-xs text-muted-foreground">&bull;</span>
            <span className="text-xs text-muted-foreground">{new Date(reply.createdAt).toLocaleDateString()}</span>
            
            {reply.isAcceptedAnswer && (
              <div className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3" /> Accepted Answer
              </div>
            )}
          </div>

          {/* HTML Content */}
          <div 
            className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 leading-relaxed mb-3"
            dangerouslySetInnerHTML={{ __html: reply.content }}
          />

          {/* Actions */}
          <div className="flex items-center gap-4 text-muted-foreground">
            <button className="flex items-center gap-1.5 text-xs font-medium hover:text-primary transition-colors">
              <ThumbsUp className="h-3.5 w-3.5" /> {reply.likes}
            </button>
            <button className="flex items-center gap-1.5 text-xs font-medium hover:text-primary transition-colors">
              <MessageSquare className="h-3.5 w-3.5" /> Reply
            </button>
          </div>

          {/* Nested Replies */}
          {reply.replies && reply.replies.length > 0 && (
            <div className="mt-2">
              {reply.replies.map((r: Reply) => renderReply(r, true))}
            </div>
          )}

        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-background flex flex-col relative z-0 h-full overflow-hidden">
      
      {/* Header Bar */}
      <div className="h-14 border-b border-border/40 bg-background/95 backdrop-blur-xl shrink-0 flex items-center justify-between px-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={closeThread} className="-ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Thread</span>
            <span className="text-[10px] text-muted-foreground">in {thread.tags[0]}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {thread.isLocked && <Lock className="h-4 w-4 text-muted-foreground" />}
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col relative z-0">
        
        {/* Main Post */}
        <div className="p-6 md:p-8 border-b border-border/40 bg-secondary/5">
          <h1 className="text-xl md:text-2xl font-bold text-foreground mb-4">{thread.title}</h1>
          
          <div className="flex items-center gap-3 mb-6">
            <img src={thread.author.avatar} alt={thread.author.name} className="h-10 w-10 rounded-full bg-background border border-border/50" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">{thread.author.name}</span>
              <span className="text-[10px] text-muted-foreground">{new Date(thread.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div 
            className="prose dark:prose-invert max-w-none text-foreground/90 leading-relaxed text-base"
            dangerouslySetInnerHTML={{ __html: thread.content }}
          />
        </div>

        {/* Replies Area */}
        <div className="flex flex-col flex-1 bg-background">
          <div className="p-4 border-b border-border/40 bg-background/95 sticky top-0 z-10 backdrop-blur-md">
            <span className="text-sm font-semibold">{thread.replies.length} Replies</span>
          </div>
          
          {thread.replies.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center opacity-50">
              <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm">No replies yet. Be the first to answer!</p>
            </div>
          ) : (
            <div className="flex flex-col pb-6">
              {thread.replies.map((r: Reply) => renderReply(r, false))}
            </div>
          )}

        </div>

      </div>

      {/* Composer Footer (Sticky) */}
      {!thread.isLocked && (
        <div className="shrink-0 border-t border-border/40 bg-secondary/10 p-4">
          <RichTextComposer onSubmit={handleReply} />
        </div>
      )}
      {thread.isLocked && (
        <div className="shrink-0 border-t border-border/40 bg-secondary/30 p-4 text-center">
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Lock className="h-4 w-4" /> This thread has been locked by a teacher.
          </p>
        </div>
      )}

    </div>
  );
}
