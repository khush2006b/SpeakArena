"use client";

import * as React from "react";
import { PlayCircle, Video, FileText, ChevronRight, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { apiClient } from "@/services/api/client";

export function RecentActivityFeed() {
  const [activities, setActivities] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await apiClient.get("/api/v1/notifications?page=1&page_size=5");
        const data = res.data?.data || res.data || [];
        const items = Array.isArray(data) ? data : (data.items || []);
        setActivities(items);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };
    fetchActivity();
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case "video": return <PlayCircle className="h-4 w-4 text-primary" />;
      case "meeting": return <Video className="h-4 w-4 text-amber-500" />;
      case "pdf": return <FileText className="h-4 w-4 text-emerald-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card className="h-full flex flex-col card-glass hover-lift" style={{ borderRadius: 16 }}>
      <CardHeader className="p-4 sm:p-6 pb-0 flex flex-row items-center justify-between">
        <CardTitle className="text-responsive-lg flex items-center gap-2 text-foreground font-extrabold">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Recent Activity
        </CardTitle>
        <Link href="/student/notifications">
          <Button variant="ghost" size="sm" className="text-xs hover:text-primary/80 -mr-2 text-primary btn-ghost press-scale">
            View All <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-4 flex-1">
        
        {isLoading ? (
          <div className="space-y-4">
             <div className="h-10 rounded-lg bg-border/40 animate-pulse" />
             <div className="h-10 rounded-lg bg-border/40 animate-pulse" />
             <div className="h-10 rounded-lg bg-border/40 animate-pulse" />
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-sm text-muted-foreground">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity: any, idx: number) => (
              <div key={activity.id || activity._id || idx} className="relative flex gap-4 group hover-lift p-2 rounded-xl transition-colors hover:bg-accent/50">
                {/* Timeline line */}
                {idx !== activities.length - 1 && (
                  <div className="absolute top-8 left-[27px] bottom-[-16px] w-px bg-border" />
                )}
                
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full z-10 transition-colors bg-card border border-border">
                  {getIcon(activity.type || activity.notification_type)}
                </div>
                
                <div className="flex flex-col pt-1">
                  <span className="text-sm font-medium line-clamp-1 text-foreground">{activity.title || "New Activity"}</span>
                  <span className="text-xs text-muted-foreground">
                    {activity.created_at ? new Date(activity.created_at).toLocaleDateString() : (activity.timestamp || "Just now")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

      </CardContent>
    </Card>
  );
}
