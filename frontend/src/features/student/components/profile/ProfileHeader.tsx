"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Edit2, Flame, Camera, Upload } from "lucide-react";
import { useStudentProfileStore } from "@/stores/student-profile.store";
import { useAuthStore } from "@/stores/auth.store";

export function ProfileHeader() {
  const { setIsEditingProfile } = useStudentProfileStore();
  const { user } = useAuthStore();

  const fullName = user?.fullName || "Student";
  const avatarUrl = user?.avatarUrl || "";
  const createdAt = user?.createdAt ? parseISO(user.createdAt) : new Date();

  return (
    <div className="w-full relative mb-16 md:mb-20">

      {/* Cover Photo with grid-bg texture and glow */}
      <div className="h-48 md:h-64 w-full rounded-b-3xl md:rounded-3xl overflow-hidden relative group grid-bg bg-card">
        {/* Indigo ambient glow */}
        <div className="glow-indigo w-[60%] h-[200%] -top-1/2 left-1/4 opacity-60" />
        <img
          src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='400' viewBox='0 0 1200 400'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%231e1b4b'/><stop offset='50%' stop-color='%23312e81'/><stop offset='100%' stop-color='%234338ca'/></linearGradient></defs><rect width='1200' height='400' fill='url(%23g)'/></svg>"
          alt="Profile Cover"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-4">
          <button className="btn-ghost backdrop-blur-sm text-sm px-3 py-1.5 press-scale">
            <Camera className="h-4 w-4" /> Change Cover
          </button>
        </div>
      </div>

      {/* Avatar & Basic Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative -mt-16 md:-mt-20 flex flex-col md:flex-row md:items-end justify-between gap-4">

        <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-6">
          <div className="relative group w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden bg-card border-4 border-background hover-lift">
            <Avatar className="w-full h-full rounded-none">
              <AvatarImage src={avatarUrl} alt={fullName} className="object-cover" />
              <AvatarFallback className="text-4xl bg-white/10 text-foreground">{fullName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
              onClick={() => setIsEditingProfile(true)}
            >
              <Upload className="h-6 w-6 mb-1" />
              <span className="text-xs font-medium">Update Photo</span>
            </div>
          </div>

          <div className="pb-2 md:pb-4 flex flex-col items-start">
            <h1 className="text-foreground font-extrabold tracking-tight text-responsive-md">{fullName}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge
                variant="secondary"
                className="font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
              >
                Active Student
              </Badge>
              <span className="text-sm flex items-center gap-1.5 text-muted-foreground">
                <Flame className="h-4 w-4 fill-current text-amber-400" />
                1 Day Streak
              </span>
              <span className="text-sm hidden sm:inline-block text-muted-foreground/70">
                &bull; Member since {format(createdAt, "MMM yyyy")}
              </span>
            </div>
          </div>
        </div>

        {/* Profile Completion & Actions */}
        <div className="pb-2 md:pb-4 flex flex-col gap-4 w-full md:w-64">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Profile Completion</span>
              <span className="text-primary">85%</span>
            </div>
            <div className="w-full rounded-full h-2 overflow-hidden bg-white/5">
              <div
                className="h-full rounded-full bg-primary transition-all duration-1000"
                style={{ width: "85%" }}
              />
            </div>
          </div>
          <button
            className="btn-ghost w-full press-scale"
            onClick={() => setIsEditingProfile(true)}
          >
            <Edit2 className="h-4 w-4" /> Edit Profile
          </button>
        </div>

      </div>
    </div>
  );
}
