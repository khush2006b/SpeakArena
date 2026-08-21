"use client";

import { Camera, ShieldCheck, MapPin, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTeacherProfile } from "@/hooks/queries/useTeacherQueries";
import { Skeleton } from "@/components/ui/skeleton";

export function ProfileCard() {
  const { data: user, isLoading } = useTeacherProfile();

  if (isLoading || !user) {
    return (
      <div className="card-glass flex flex-col overflow-hidden sticky top-6 animate-fade-up">
        <Skeleton className="h-40 w-full bg-border/30" />
        <div className="px-8 pb-8 relative">
          <Skeleton className="absolute -top-16 w-32 h-32 rounded-2xl border-[6px] border-background bg-border/30" />
          <div className="mt-20 space-y-4">
            <Skeleton className="h-8 w-3/4 bg-border/30" />
            <Skeleton className="h-5 w-1/2 bg-border/30" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-glass hover-lift flex flex-col overflow-hidden sticky top-6 animate-fade-up group/card">

      {/* Cover Image */}
      <div className="relative h-40 w-full bg-gradient-to-r from-violet-500/30 via-violet-500/10 to-violet-500/5 group cursor-pointer overflow-hidden grid-bg">
        <div className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-sm">
          <Button variant="secondary" size="sm" className="btn-ghost font-bold tracking-wide rounded-xl h-10 px-4 press-scale">
            <Camera className="mr-2 h-4 w-4" /> Change Cover
          </Button>
        </div>
      </div>

      <div className="px-8 pb-8 relative">
        {/* Avatar */}
        <div className="relative -mt-16 w-32 h-32 rounded-2xl border-[6px] border-background bg-secondary shadow-[0_8px_24px_rgba(0,0,0,0.5)] group cursor-pointer overflow-hidden z-10 flex items-center justify-center hover-lift">
            <img src={user.avatarUrl || "/images/paras_teacher.png"} alt={user.fullName} className="w-full h-full object-cover object-top transition-all duration-500 group-hover:scale-110 group-hover:opacity-50" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-background/40 backdrop-blur-[2px]">
            <Camera className="h-8 w-8 text-foreground drop-shadow-md" />
          </div>
        </div>

        {/* Identity Details */}
        <div className="mt-5 space-y-1.5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              {user.fullName}
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </h2>
          </div>
          <p className="text-[15px] font-bold text-violet-400 tracking-wide">Instructor</p>
          <div className="flex items-center gap-5 text-xs text-muted-foreground mt-3 font-semibold tracking-wide uppercase">
            <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Earth</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> UTC</span>
          </div>
        </div>

        {/* Status */}
        <div className="mt-8 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between transition-colors group-hover/card:bg-emerald-500/15">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
            </span>
            <span className="text-sm font-bold text-emerald-400 tracking-wide">Available to teach</span>
          </div>
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 font-bold uppercase tracking-widest text-[10px] px-2 py-1">Online</Badge>
        </div>

      </div>
    </div>
  );
}
