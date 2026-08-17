"use client";

import * as React from "react";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileSidebar } from "./ProfileSidebar";
import { LearningSummary } from "./LearningSummary";
import { LearningTimeline } from "./LearningTimeline";
import { AchievementsList } from "./AchievementsList";
import { LearningGoals } from "./LearningGoals";
import { ProfileEditor } from "./ProfileEditor";

export function StudentProfileDashboard() {
  return (
    <div className="flex-1 w-full overflow-y-auto custom-scrollbar animate-fade-up pb-20 bg-background min-h-screen">

      {/* Top Banner & Header Info */}
      <ProfileHeader />

      {/* Indigo ambient glow for student section */}
      <div className="relative">
        <div className="glow-indigo w-[500px] h-[500px] -top-40 left-1/2 -translate-x-1/2 opacity-30 pointer-events-none" />
      </div>

      {/* 3-Column Layout Workspace */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-8">

        {/* Left Column: Identity & Security */}
        <ProfileSidebar />

        {/* Center Column: The Learning Journey */}
        <div className="flex-1 min-w-0">
          <LearningSummary />
          <LearningTimeline />
        </div>

        {/* Right Column: Gamification & Goals */}
        <div className="flex flex-col gap-6 w-full lg:w-72 shrink-0">
          <AchievementsList />
          <LearningGoals />
        </div>

      </div>

      {/* Editor Modal */}
      <ProfileEditor />

    </div>
  );
}
