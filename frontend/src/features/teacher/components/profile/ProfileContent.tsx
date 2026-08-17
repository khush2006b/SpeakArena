"use client";

import * as React from "react";
import { ProfileCard } from "@/features/teacher/components/profile/ProfileCard";
import { ProfileEditor } from "@/features/teacher/components/profile/ProfileEditor";
import { PublicPreview } from "@/features/teacher/components/profile/PublicPreview";
import { ProfileSidebar } from "@/features/teacher/components/profile/ProfileSidebar";
import { AchievementCards } from "@/features/teacher/components/profile/AchievementCards";
import { useProfileStore } from "@/stores/profile.store";

export function ProfileContent() {
  const { isPreviewMode } = useProfileStore();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 w-full animate-fade-up">

      {/* Left Sidebar (Profile Card) */}
      <div className="lg:col-span-3">
        <ProfileCard />
      </div>

      {/* Center Content (Forms or Preview) */}
      <div className="lg:col-span-6 flex flex-col gap-6">
        <div className="card-glass min-h-[600px] overflow-hidden">
          {isPreviewMode ? <PublicPreview /> : (
            <div className="p-6 sm:p-8">
              <ProfileEditor />
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar (Stats & Gamification) */}
      <div className="lg:col-span-3 flex flex-col gap-6">
        <ProfileSidebar />
        {!isPreviewMode && <AchievementCards />}
      </div>

    </div>
  );
}
