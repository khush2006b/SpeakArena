"use client";

import * as React from "react";
import { PlayCircle, Video, FileText, ChevronRight, Activity, BookOpen, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { apiClient } from "@/services/api/client";
import { useRouter } from "next/navigation";

export function RecentActivityFeed() {
  const router = useRouter();
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
        console.error("Failed to load activities:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchActivity();
  }, []);

  const getIcon = (type: string) => {
    const t = (type || "").toLowerCase();
    if (t.includes("video") || t.includes("lesson")) return <PlayCircle className="h-4 w-4 text-primary" />;
    if (t.includes("meeting") || t.includes("live") || t.includes("class")) return <Video className="h-4 w-4 text-amber-500" />;
    if (t.includes("pdf") || t.includes("resource") || t.includes("assignment")) return <FileText className="h-4 w-4 text-emerald-500" />;
    if (t.includes("course") || t.includes("enroll")) return <BookOpen className="h-4 w-4 text-indigo-400" />;
    return <Bell className="h-4 w-4 text-muted-foreground" />;
  };

  const handleActivityClick = (item: any) => {
    if (item.action_url && item.action_url.startsWith("/")) {
      router.push(item.action_url);
    } else {
      const type = (item.type || item.notification_type || "").toLowerCase();
      if (type.includes("meeting") || type.includes("live")) {
        router.push("/student/live");
      } else if (type.includes("course") || type.includes("enroll")) {
        router.push("/student/courses");
      } else if (type.includes("chat") || type.includes("message")) {
        router.push("/student/messages");
      } else {
        router.push("/student/notifications");
      }
    }
  };

  return (
    <Card className="h-full flex flex-col card-glass hover-lift" style={{ borderRadius: 16 }}>
      <CardHeader className="p-4 sm:p-6 pb-0 flex flex-row items-center justify-between">
        <CardTitle className="text-responsive-lg flex items-center gap-2 text-foreground font-extrabold">
          <Activity className="h-4 w-4 text-primary" />
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
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
            <Activity className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-muted-foreground">No recent activity</p>
            <p className="text-xs text-muted-foreground/80 max-w-xs">
              Your recent course updates and live class activity will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity: any, idx: number) => (
              <div 
                key={activity.id || activity._id || idx} 
                onClick={() => handleActivityClick(activity)}
                className="relative flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all hover:bg-white/5 border border-transparent hover:border-white/10 hover-lift"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors bg-card border border-border/80 shadow-sm">
                  {getIcon(activity.type || activity.notification_type)}
                </div>
                
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-xs font-bold line-clamp-1 text-foreground">{activity.title || "Platform Update"}</span>
                  <span className="text-[11px] text-muted-foreground line-clamp-1">
                    {activity.body || activity.message || "Click to open details"}
                  </span>
                </div>

                <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                  {activity.created_at ? new Date(activity.created_at).toLocaleDateString() : (activity.timestamp || "Today")}
                </span>
              </div>
            ))}
          </div>
        )}

      </CardContent>
    </Card>
  );
}
