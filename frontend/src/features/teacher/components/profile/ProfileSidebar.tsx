"use client";

import * as React from "react";
import { CheckCircle2, Circle, Eye, PenLine, ExternalLink } from "lucide-react";
import { useProfileStore } from "@/stores/profile.store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CHECKLIST = [
  { id: "photo", label: "Upload profile picture", completed: true },
  { id: "bio", label: "Add a short bio", completed: true },
  { id: "experience", label: "Add teaching experience", completed: true },
  { id: "social", label: "Add social links", completed: true },
  { id: "youtube", label: "Link YouTube channel", completed: false },
  { id: "video", label: "Upload welcome video", completed: false },
];

export function ProfileSidebar() {
  const { isPreviewMode, togglePreviewMode, completionPercentage } = useProfileStore();

  return (
    <div className="flex flex-col gap-6 sticky top-6">

      {/* Action Toggle */}
      <div className="card-glass p-6 flex flex-col gap-5">
        <h3 className="font-extrabold text-[15px] tracking-wide uppercase text-foreground">Profile View</h3>
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-border/20 rounded-2xl border border-border/30">
          <Button
            variant={!isPreviewMode ? "default" : "ghost"}
            size="sm"
            onClick={isPreviewMode ? togglePreviewMode : undefined}
            className={cn(
              "w-full h-10 rounded-xl font-bold tracking-wide transition-all duration-300 press-scale",
              !isPreviewMode
                ? "bg-card/80 text-foreground shadow-md border border-border/50"
                : "text-muted-foreground hover:bg-card/40"
            )}
          >
            <PenLine className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button
            variant={isPreviewMode ? "default" : "ghost"}
            size="sm"
            onClick={!isPreviewMode ? togglePreviewMode : undefined}
            className={cn(
              "w-full h-10 rounded-xl font-bold tracking-wide transition-all duration-300 press-scale",
              isPreviewMode
                ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                : "text-muted-foreground hover:bg-card/40"
            )}
          >
            <Eye className="mr-2 h-4 w-4" /> Preview
          </Button>
        </div>
        <Button variant="outline" size="sm" className="btn-outline w-full h-11 rounded-xl font-bold tracking-wide transition-colors press-scale">
          <ExternalLink className="mr-2 h-4 w-4" /> Copy Public Link
        </Button>
      </div>

      {/* Gamification / Completion */}
      <div className="card-glass p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-[15px] tracking-wide uppercase text-foreground">Profile Strength</h3>
          <span className="text-lg font-black text-violet-400">{completionPercentage}%</span>
        </div>

        {/* Custom Progress Bar */}
        <div className="relative h-2.5 mb-8 bg-border/30 rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-violet-500/80 to-violet-400 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>

        <div className="space-y-5">
          <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <div className="h-px flex-1 bg-border/40"></div>
            Next Steps
            <div className="h-px flex-1 bg-border/40"></div>
          </h4>
          <ul className="space-y-3">
            {CHECKLIST.map(item => (
              <li key={item.id} className="flex items-start gap-3 group">
                {item.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5 group-hover:text-violet-400 transition-colors" />
                )}
                <span className={cn(
                  "text-sm font-semibold transition-colors mt-0.5 leading-tight",
                  item.completed ? "text-muted-foreground line-through opacity-50" : "text-foreground group-hover:text-violet-400/80"
                )}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

    </div>
  );
}
