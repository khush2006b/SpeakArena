"use client";

import * as React from "react";
import { Flame, Trophy, Target, Clock, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/services/api/client";

export function LearningStreakWidget() {
  const [profileData, setProfileData] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await apiClient.get("/api/v1/profile");
        const data = res.data?.data || res.data || {};
        setProfileData(data);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const streak = profileData?.streak_days || 0;
  const longestStreak = profileData?.longest_streak || streak || 0;
  const weeklyGoal = profileData?.weekly_goal || 7;
  const daysActiveThisWeek = profileData?.days_active_this_week || Math.min(streak, 7);
  const totalHours = profileData?.total_hours || 0;
  
  const progressPercent = (daysActiveThisWeek / weeklyGoal) * 100;

  return (
    <Card className="h-full overflow-hidden card-glass hover-lift" style={{ borderRadius: 16 }}>
      <CardContent className="p-4 sm:p-6 lg:p-8 space-y-6">
        
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Top: Streak Banner */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-responsive-lg flex items-center gap-2 text-foreground font-extrabold">
                  <Flame className="h-5 w-5 fill-current text-primary" />
                  Learning Streak
                </h3>
                <p className="text-sm mt-1 text-muted-foreground page-subtitle">You're on fire! Keep it up.</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-3xl text-foreground font-extrabold">{streak}</span>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Days</span>
              </div>
            </div>

            {/* Middle: Weekly Goal Progress */}
            <div className="space-y-2 rounded-xl p-4 bg-card border border-border">
              <div className="flex justify-between items-center text-sm font-medium">
                <span className="flex items-center gap-2 text-foreground">
                  <Target className="h-4 w-4 text-primary" /> Weekly Goal
                </span>
                <span className="text-muted-foreground">{daysActiveThisWeek} / {weeklyGoal} days</span>
              </div>
              <div className="w-full rounded-full h-2 overflow-hidden bg-border">
                <div 
                  className="h-2 rounded-full transition-all duration-1000 ease-out bg-primary" 
                  style={{ width: `${progressPercent}%` }} 
                />
              </div>
            </div>

            {/* Bottom: Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex flex-col p-3 rounded-xl bg-card border border-border card-stat hover-lift">
                <span className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 mb-1 text-muted-foreground">
                  <Trophy className="h-3.5 w-3.5 text-primary" /> Longest
                </span>
                <span className="text-xl text-foreground font-extrabold">
                  {longestStreak} <span className="text-sm font-normal lowercase text-muted-foreground">days</span>
                </span>
              </div>
              <div className="flex flex-col p-3 rounded-xl bg-card border border-border card-stat hover-lift">
                <span className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 mb-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-primary" /> Total Time
                </span>
                <span className="text-xl text-foreground font-extrabold">
                  {totalHours} <span className="text-sm font-normal lowercase text-muted-foreground">hours</span>
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
