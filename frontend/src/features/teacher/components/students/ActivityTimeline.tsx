"use client";

import * as React from "react";
import { 
  MessageSquare, 
  Video, 
  FileText, 
  Award, 
  UserCheck, 
  Loader2 
} from "lucide-react";
import { teacherService } from "@/services/teacher.service";

interface ActivityEvent {
  id: string;
  type: "message" | "meeting" | "submission" | "certificate" | "enrollment";
  title: string;
  timestamp: string;
  description: string;
}

export function ActivityTimeline({ studentId }: { studentId?: string }) {
  const [events, setEvents] = React.useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchEvents() {
      if (!studentId) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const data = await teacherService.getStudentAttendance(studentId);
        const records = data?.items || data || [];
        const mapped: ActivityEvent[] = records.map((item: any, idx: number) => ({
          id: item.id || `att-${idx}`,
          type: item.status === "PRESENT" ? "meeting" : "message",
          title: item.meeting_title || "Class Session",
          timestamp: item.joined_at ? new Date(item.joined_at).toLocaleString() : (item.date || "Unknown date"),
          description: `Duration: ${item.duration_minutes || 0} mins`,
        }));
        setEvents(mapped);
      } catch {
      } finally {
        setIsLoading(false);
      }
    }
    fetchEvents();
  }, [studentId]);

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>;
  }

  if (events.length === 0) {
    return <div className="text-center py-10 text-muted-foreground border border-dashed border-border/50 rounded-xl">No activity recorded yet.</div>;
  }

  const getEventIcon = (type: ActivityEvent["type"]) => {
    switch (type) {
      case "message":
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case "meeting":
        return <Video className="h-4 w-4 text-emerald-500" />;
      case "submission":
        return <FileText className="h-4 w-4 text-amber-500" />;
      case "certificate":
        return <Award className="h-4 w-4 text-purple-500" />;
      case "enrollment":
        return <UserCheck className="h-4 w-4 text-indigo-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border/50 before:to-transparent">
      {events.map((event, idx) => (
        <div key={event.id ? `act-${event.id}-${idx}` : `act-idx-${idx}`} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          {/* Icon Marker */}
          <div
            className="md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              border: "4px solid hsl(var(--border))",
              background: "hsl(var(--border))",
              flexShrink: 0,
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              zIndex: 10,
            }}
          >
            {getEventIcon(event.type)}
          </div>
          
          {/* Card */}
          <div
            className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)]"
            style={{
              padding: "16px",
              borderRadius: "18px",
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--border))",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            <div className="flex items-center justify-between space-x-2 mb-1">
              <span className="font-bold text-foreground text-sm">{event.title}</span>
              <time className="font-caveat font-medium text-xs text-muted-foreground">{event.timestamp}</time>
            </div>
            <p className="text-xs text-muted-foreground">{event.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
