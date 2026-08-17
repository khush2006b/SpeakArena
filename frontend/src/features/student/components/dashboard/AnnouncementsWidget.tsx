"use client";

import * as React from "react";
import { Megaphone, Pin, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api/client";

export function AnnouncementsWidget() {
  const [announcements, setAnnouncements] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await apiClient.get("/api/v1/notifications?type=announcement&page_size=5");
        const data = res.data?.data || res.data || [];
        setAnnouncements(Array.isArray(data) ? data : []);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  return (
    <Card className="h-full flex flex-col card-glass hover-lift" style={{ borderRadius: 16 }}>
      <CardHeader className="p-4 sm:p-6 pb-0 flex flex-row items-center justify-between">
        <CardTitle className="text-responsive-lg flex items-center gap-2 text-foreground font-extrabold">
          <Megaphone className="h-4 w-4 text-muted-foreground" />
          Announcements
        </CardTitle>
        <Button variant="ghost" size="sm" className="text-xs hover:text-primary/80 -mr-2 text-primary btn-ghost press-scale">
          View All <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-4 flex-1">
        
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-16 rounded-lg bg-border/40 animate-pulse" />
            <div className="h-16 rounded-lg bg-border/40 animate-pulse" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-sm text-muted-foreground">No new announcements</p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement: any) => (
              <div key={announcement.id || announcement._id || Math.random()} className="flex flex-col gap-1.5 p-3 rounded-lg transition-colors cursor-pointer bg-card border border-border hover-lift">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1.5 line-clamp-1 text-foreground">
                    {announcement.isPinned && <Pin className="h-3 w-3 fill-current text-primary" />}
                    {announcement.title}
                  </span>
                  <span className="text-[10px] shrink-0 text-muted-foreground">
                    {announcement.created_at ? new Date(announcement.created_at).toLocaleDateString() : announcement.timestamp}
                  </span>
                </div>
                <p className="text-xs line-clamp-2 text-muted-foreground leading-relaxed">
                  {announcement.body || announcement.content}
                </p>
              </div>
            ))}
          </div>
        )}

      </CardContent>
    </Card>
  );
}
