"use client";

import * as React from "react";
import { 
  CheckCircle2, 
  Video, 
  CreditCard, 
  FileText,
  UserPlus,
  Mail,
  Loader2
} from "lucide-react";
import { apiClient } from "@/services/api/client";
import { useEffect, useState } from "react";

interface TimelineEvent {
  id: string;
  type: "purchase" | "meeting" | "lesson" | "document" | "registration" | "message";
  title: string;
  timestamp: string;
  description?: string;
}

function getEventIcon(type: TimelineEvent["type"]) {
  switch (type) {
    case "purchase": return <CreditCard style={{ height: "16px", width: "16px", color: "#f59e0b" }} />;
    case "meeting": return <Video style={{ height: "16px", width: "16px", color: "#3b82f6" }} />;
    case "lesson": return <CheckCircle2 style={{ height: "16px", width: "16px", color: "#10b981" }} />;
    case "document": return <FileText style={{ height: "16px", width: "16px", color: "hsl(var(--primary))" }} />;
    case "message": return <Mail style={{ height: "16px", width: "16px", color: "#a855f7" }} />;
    case "registration": return <UserPlus style={{ height: "16px", width: "16px", color: "hsl(var(--muted-foreground))" }} />;
  }
}

export function ActivityTimeline({ studentId }: { studentId?: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      if (!studentId) {
        setIsLoading(false);
        return;
      }
      try {
        const response = await apiClient.get(`/api/v1/teacher/students/${studentId}/attendance`);
        const data = Array.isArray(response.data?.items) ? response.data.items : (Array.isArray(response.data) ? response.data : []);
        const mapped = data.map((item: any, i: number) => ({
          id: item.id || `evt-${i}`,
          type: item.status === "PRESENT" ? "meeting" : "message",
          title: item.meeting_title || "Class Session",
          timestamp: item.joined_at ? new Date(item.joined_at).toLocaleString() : (item.date || "Unknown date"),
          description: `Duration: ${item.duration_minutes || 0} mins`,
        }));
        setEvents(mapped);
      } catch (error) {
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

  return (
    <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border/50 before:to-transparent">
      {events.map((event) => (
        <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
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
              transition: "all 0.2s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
              e.currentTarget.style.borderColor = "rgba(124,58,237,0.2)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";
              e.currentTarget.style.borderColor = "hsl(var(--border))";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <h4 style={{ fontWeight: 600, fontSize: "14px", color: "hsl(var(--foreground))", margin: 0 }}>{event.title}</h4>
              <span style={{ fontSize: "10px", fontWeight: 500, color: "hsl(var(--muted-foreground))", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "4px" }}>{event.timestamp}</span>
            </div>
            {event.description && (
              <p style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))", marginTop: "8px", background: "hsl(var(--border))", padding: "8px", borderRadius: "6px", border: "1px solid hsl(var(--border))", margin: 0 }}>
                {event.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
