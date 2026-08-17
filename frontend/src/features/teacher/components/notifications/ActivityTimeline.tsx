"use client";

import * as React from "react";
import { format } from "date-fns";
import { 
  CreditCard, 
  Users, 
  Video, 
  Settings, 
  CheckCircle2,
  Circle,
  Loader2
} from "lucide-react";
import { useTeacherActivity } from "@/hooks/queries/useTeacherQueries";
import { cn } from "@/lib/utils";

const getTypeIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case "payment": return <CreditCard className="h-4 w-4" />;
    case "student": return <Users className="h-4 w-4" />;
    case "meeting": return <Video className="h-4 w-4" />;
    case "system": return <Settings className="h-4 w-4" />;
    default: return <CheckCircle2 className="h-4 w-4" />;
  }
};

const getTypeColor = (type: string) => {
  switch (type.toLowerCase()) {
    case "payment": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.3)]";
    case "student": return "bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_15px_rgba(96,165,250,0.3)]";
    case "meeting": return "bg-orange-500/10 text-orange-400 border-orange-500/30 shadow-[0_0_15px_rgba(251,146,60,0.3)]";
    default: return "bg-white/10 text-muted-foreground border-white/20";
  }
};

export function ActivityTimeline() {
  const { data: activities, isLoading } = useTeacherActivity(20);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const items = activities || [];

  return (
    <div className="p-8 max-w-2xl mx-auto w-full">
      <div className="mb-10">
        <h3 className="font-extrabold text-2xl tracking-tight text-foreground drop-shadow-sm">Platform Activity</h3>
        <p className="text-muted-foreground text-sm font-semibold mt-1 opacity-80">A chronological timeline of events across your courses.</p>
      </div>

      <div className="relative border-l-2 border-white/10 ml-4 space-y-10 pb-8">
        {items.length === 0 ? (
          <div className="pl-8 text-sm text-muted-foreground font-semibold">No recent activity found.</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="relative pl-8 group">
              {/* Timeline Dot/Icon */}
              <div className={cn(
                "absolute -left-[19px] top-0.5 flex h-9 w-9 items-center justify-center rounded-full border bg-background/50 backdrop-blur-md transition-transform duration-300 group-hover:scale-110",
                getTypeColor(item.type)
              )}>
                {getTypeIcon(item.type)}
              </div>

              {/* Content */}
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {item.title}
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-70">
                  {format(new Date(item.timestamp), "MMM d, yyyy 'at' h:mm a")}
                </span>
              </div>
              
              {/* Optional Card representation of the event */}
              <div className="mt-3 p-4 rounded-xl border border-transparent bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-colors text-sm font-semibold text-muted-foreground shadow-[inset_0_1px_1px_hsl(var(--border))] leading-relaxed">
                {item.description}
              </div>
            </div>
          ))
        )}

        <div className="relative pl-8">
          <div className="absolute -left-[11px] top-2 flex h-5 w-5 items-center justify-center bg-background rounded-full border-2 border-white/10 shadow-[0_0_10px_hsl(var(--border))]">
            <Circle className="h-2 w-2 text-foreground/30 fill-white/30" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50 italic mt-2 block">End of timeline</span>
        </div>
      </div>
    </div>
  );
}
