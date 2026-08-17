"use client";

import * as React from "react";
import { Video, Calendar, User, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api/client";

export function NextLiveClassCard() {
  const [meeting, setMeeting] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchMeeting = async () => {
      try {
        const res = await apiClient.get("/api/v1/meetings?page=1&page_size=1");
        const data = res.data?.data || res.data || [];
        const items = Array.isArray(data) ? data : (data.items || []);
        if (items.length > 0) {
          setMeeting(items[0]);
        }
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };
    fetchMeeting();
  }, []);

  return (
    <Card className="h-full overflow-hidden group card-glass hover-lift" style={{ borderRadius: 16 }}>
      <CardContent className="p-4 sm:p-6 lg:p-8 flex flex-col h-full">
        {isLoading ? (
          <div className="flex-1 flex justify-center items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !meeting ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 py-6">
            <Calendar className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No upcoming live classes</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold border text-primary badge-primary bg-primary/10 border-primary/25"
                   style={{ borderRadius: 100 }}>
                <span className="relative flex h-2 w-2 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-primary"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                Next Live Class
              </div>
              <span className="text-sm font-bold text-foreground">
                {meeting.status || "Scheduled"}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 space-y-3">
              <h3 className="font-semibold text-responsive-lg leading-tight line-clamp-2 text-foreground">
                {meeting.title || "Live Session"}
              </h3>
              <div className="space-y-1.5">
                <p className="text-sm flex items-center gap-2 text-muted-foreground">
                  <BookOpenIcon className="h-4 w-4" />
                  <span className="truncate">
                    {meeting.courseTitle || (meeting.scheduled_at ? new Date(meeting.scheduled_at).toLocaleString() : "TBA")}
                  </span>
                </p>
                <p className="text-sm flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{meeting.teacherName || meeting.instructor || "Instructor"}</span>
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-6 mt-auto flex items-center gap-3">
              <Button className="flex-1 shadow-md transition-all font-bold btn-primary press-scale"
                      style={{ borderRadius: 10 }}>
                <Video className="mr-2 h-4 w-4" /> Join Class
              </Button>
              <Button variant="outline" size="icon" className="shrink-0 text-muted-foreground btn-outline press-scale" title="Add to Calendar"
                      style={{ borderRadius: 10 }}>
                <Calendar className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BookOpenIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}
