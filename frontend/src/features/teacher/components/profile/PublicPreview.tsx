"use client";

import * as React from "react";
import { useTeacherProfile } from "@/hooks/queries/useTeacherQueries";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye } from "lucide-react";

export function PublicPreview() {
  const { data: user, isLoading } = useTeacherProfile();

  if (isLoading || !user) {
    return (
      <div className="space-y-8 p-4">
        <Skeleton className="h-40 w-full bg-border/30 rounded-3xl" />
        <Skeleton className="h-40 w-full bg-border/30 rounded-3xl" />
      </div>
    );
  }

  // Safely extract optional fields
  const bio = (user as any).bio || "No biography provided yet.";
  const language = (user as any).language || "English";
  const timezone = (user as any).timezone || "UTC";

  return (
    <div className="space-y-8 animate-fade-up p-6 sm:p-8">

      <div className="p-4 bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent border-l-4 border-emerald-500 text-emerald-400 rounded-r-2xl text-sm flex items-center gap-3 font-bold tracking-wide">
        <Eye className="h-5 w-5 shrink-0" />
        This is exactly how students will see your profile.
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-extrabold text-foreground mb-4 tracking-tight">About {user.fullName.split(" ")[0]}</h3>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-sm md:text-base font-medium p-6 rounded-2xl bg-card/50 border border-border/40">
            {bio}
          </p>
        </div>

        <div className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-6 relative before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-border/50 before:to-transparent">

          <div className="card-glass hover-lift space-y-5 p-6 rounded-2xl">
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <div className="h-4 w-1 bg-violet-500 rounded-full"></div>
              Expertise &amp; Style
            </h4>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Timezone</span>
                <p className="text-[15px] font-extrabold text-foreground">{timezone}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</span>
                <p className="text-[15px] font-extrabold text-foreground flex items-center gap-2">
                  {user.isActive ? (
                    <><span className="h-2 w-2 rounded-full bg-emerald-400" /> Active Teacher</>
                  ) : (
                    <><span className="h-2 w-2 rounded-full bg-muted-foreground" /> Inactive</>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="card-glass hover-lift space-y-5 p-6 rounded-2xl">
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
              Languages
            </h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="font-bold text-[11px] uppercase tracking-widest px-3 py-1.5 bg-blue-500/10 text-blue-400 border-blue-500/30">
                {language}
              </Badge>
            </div>
          </div>

        </div>
      </div>

      <div className="pt-8 flex items-center justify-center opacity-50 relative before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-border/30 before:to-transparent">
        <p className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">Course listings are automatically appended to the bottom of the public profile.</p>
      </div>

    </div>
  );
}
