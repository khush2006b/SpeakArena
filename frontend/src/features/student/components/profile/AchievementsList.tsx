"use client";

import * as React from "react";
import { Trophy, Moon, Flame, Clock, Calendar, Footprints, Loader2 } from "lucide-react";
import { apiClient } from "@/services/api/client";

const ICONS: Record<string, React.ElementType> = {
  footprints: Footprints,
  moon: Moon,
  flame: Flame,
  clock: Clock,
  trophy: Trophy,
  calendar: Calendar,
};

export function AchievementsList() {
  const [achievements, setAchievements] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchAchievements = async () => {
      try {
        const res = await apiClient.get('/api/v1/profile/achievements');
        setAchievements(res.data?.items ?? res.data?.data ?? res.data ?? []);
      } catch (error) {
        // Fallback or empty if not implemented
        setAchievements([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAchievements();
  }, []);

  return (
    <div className="w-full shrink-0 flex flex-col gap-6">
      <div className="card-glass p-5">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-foreground font-extrabold text-lg m-0">Achievements</h3>
          <span className="badge-primary">
            {achievements.length} Unlocked
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : achievements.length === 0 ? (
          <div className="text-center p-6 bg-white/[0.02] border border-border/50 rounded-2xl">
            <Trophy className="mx-auto text-muted-foreground mb-2" size={32} />
            <p className="text-sm font-bold text-muted-foreground">Achievements coming soon</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {achievements.map((ach: any) => {
              const Icon = ICONS[ach.icon] || Trophy;

              return (
                <div
                  key={ach.id}
                  className="p-3 rounded-2xl flex flex-col items-center justify-center text-center transition-all duration-200 border bg-white/[0.03] border-border/50 cursor-pointer hover:bg-white/[0.05] hover-lift"
                  title={ach.description}
                >
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-2 p-2 bg-primary/12 text-primary">
                    <Icon size={20} />
                  </div>
                  <h4 className="text-foreground text-xs font-extrabold leading-tight m-0">{ach.title}</h4>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
