"use client";

import * as React from "react";
import { Megaphone, Pin, ChevronRight, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { apiClient } from "@/services/api/client";
import { useRouter } from "next/navigation";

export function AnnouncementsWidget() {
  const router = useRouter();
  const [announcements, setAnnouncements] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await apiClient.get("/api/v1/notifications?unread_only=false&page_size=5");
        const raw = res.data;
        let data: any[] = [];
        if (Array.isArray(raw?.data)) data = raw.data;
        else if (Array.isArray(raw?.items)) data = raw.items;
        else if (Array.isArray(raw)) data = raw;

        setAnnouncements(data);
      } catch (error) {
        console.error("Failed to load announcements:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  const handleAnnouncementClick = (item: any) => {
    if (item.action_url && item.action_url.startsWith("/")) {
      router.push(item.action_url);
    } else if (item.course_id || item.entity_id) {
      router.push(`/student/messages?courseId=${item.course_id || item.entity_id}`);
    } else {
      router.push("/student/messages");
    }
  };

  return (
    <Card className="h-full flex flex-col card-glass hover-lift" style={{ borderRadius: 16 }}>
      <CardHeader className="p-4 sm:p-6 pb-0 flex flex-row items-center justify-between">
        <CardTitle className="text-responsive-lg flex items-center gap-2 text-foreground font-extrabold">
          <Megaphone className="h-4 w-4 text-amber-500" />
          Announcements
        </CardTitle>
        <Link href="/student/messages">
          <Button variant="ghost" size="sm" className="text-xs hover:text-primary/80 -mr-2 text-primary btn-ghost press-scale">
            View All <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-4 flex-1">
        
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-16 rounded-lg bg-border/40 animate-pulse" />
            <div className="h-16 rounded-lg bg-border/40 animate-pulse" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-muted-foreground">No new announcements</p>
            <p className="text-xs text-muted-foreground/80 max-w-xs">
              Important course notices and teacher updates will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement: any, idx: number) => (
              <div 
                key={announcement.id || announcement._id || idx} 
                onClick={() => handleAnnouncementClick(announcement)}
                className="flex flex-col gap-1.5 p-3 rounded-xl transition-all cursor-pointer bg-card border border-border/80 hover:border-primary/40 hover-lift"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5 line-clamp-1 text-foreground">
                    {announcement.isPinned && <Pin className="h-3 w-3 fill-current text-primary" />}
                    {announcement.title || announcement.subject || "Course Notice"}
                  </span>
                  <span className="text-[10px] shrink-0 text-muted-foreground font-medium">
                    {announcement.created_at ? new Date(announcement.created_at).toLocaleDateString() : (announcement.timestamp || "Today")}
                  </span>
                </div>
                <p className="text-xs line-clamp-2 text-muted-foreground leading-relaxed">
                  {announcement.body || announcement.content || "Click to open course discussions."}
                </p>
              </div>
            ))}
          </div>
        )}

      </CardContent>
    </Card>
  );
}
