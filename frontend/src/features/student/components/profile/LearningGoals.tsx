"use client";

import * as React from "react";
import { Target, CheckCircle2, Loader2, Edit2 } from "lucide-react";
import { apiClient } from "@/services/api/client";

export function LearningGoals() {
  const [goals, setGoals] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchGoals = async () => {
      try {
        const res = await apiClient.get('/api/v1/profile');
        const data = res.data?.data || res.data || res;
        if (data.daily_minutes_target || data.weekly_lessons_target) {
          setGoals({
            dailyMinutesCurrent: data.daily_minutes_current || 0,
            dailyMinutesTarget: data.daily_minutes_target || 30,
            weeklyLessonsCurrent: data.weekly_lessons_current || 0,
            weeklyLessonsTarget: data.weekly_lessons_target || 5,
          });
        }
      } catch (error) {
        // Silently handle if goals aren't configured
      } finally {
        setIsLoading(false);
      }
    };
    fetchGoals();
  }, []);

  if (isLoading) {
    return (
      <div className="w-full shrink-0 flex flex-col gap-6 mt-6">
        <div className="card-glass p-5 flex justify-center items-center h-[200px]">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      </div>
    );
  }

  if (!goals) {
    return (
      <div className="w-full shrink-0 flex flex-col gap-6 mt-6">
        <div className="card-glass p-5 flex flex-col items-center justify-center text-center gap-4 py-8">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Target size={24} />
          </div>
          <div>
            <h3 className="font-extrabold text-foreground m-0">Set your goals</h3>
            <p className="text-sm text-muted-foreground mt-1">Track your daily and weekly progress</p>
          </div>
          <button className="btn-primary press-scale text-sm py-2 px-4 mt-2">
            <Edit2 size={14} className="mr-2" /> Configure Goals
          </button>
        </div>
      </div>
    );
  }

  const dailyProgress = Math.min(100, Math.round((goals.dailyMinutesCurrent / goals.dailyMinutesTarget) * 100));
  const weeklyProgress = Math.min(100, Math.round((goals.weeklyLessonsCurrent / goals.weeklyLessonsTarget) * 100));

  return (
    <div className="w-full shrink-0 flex flex-col gap-6 mt-6">
      <div className="card-glass p-5">
        <h3 className="text-lg font-extrabold mb-6 flex items-center gap-2 text-foreground">
          <Target size={16} className="text-amber-400" /> Learning Goals
        </h3>

        <div className="flex flex-col gap-6">

          {/* Daily Goal */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-foreground">Daily Goal</span>
              <span className="text-muted-foreground font-mono">
                {goals.dailyMinutesCurrent} / {goals.dailyMinutesTarget} mins
              </span>
            </div>
            <div className="w-full rounded-full h-2 overflow-hidden bg-white/5">
              <div
                className={[
                  "h-full rounded-full transition-all duration-1000",
                  dailyProgress >= 100 ? "bg-emerald-500" : "bg-primary"
                ].join(" ")}
                style={{ width: `${dailyProgress}%` }}
              />
            </div>
            {dailyProgress >= 100 && (
              <p className="text-xs flex items-center mt-1 text-emerald-400 m-0">
                <CheckCircle2 size={12} className="mr-1" /> Goal met!
              </p>
            )}
          </div>

          {/* Weekly Goal */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-foreground">Weekly Goal</span>
              <span className="text-muted-foreground font-mono">
                {goals.weeklyLessonsCurrent} / {goals.weeklyLessonsTarget} lessons
              </span>
            </div>
            <div className="w-full rounded-full h-2 overflow-hidden bg-white/5">
              <div
                className={[
                  "h-full rounded-full transition-all duration-1000",
                  weeklyProgress >= 100 ? "bg-emerald-500" : "bg-primary"
                ].join(" ")}
                style={{ width: `${weeklyProgress}%` }}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
