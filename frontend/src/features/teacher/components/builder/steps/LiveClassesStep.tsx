"use client";

import * as React from "react";
import { Calendar as CalendarIcon, Clock, Users, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBuilderStore } from "@/stores/builder.store";
import { apiClient } from "@/services/api/client";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

export function LiveClassesStep() {
  const { nextStep, prevStep } = useBuilderStore();
  const [meetings, setMeetings] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const router = useRouter();

  const handleDeleteMeeting = async (meetingId: string, title?: string) => {
    if (!confirm(`Are you sure you want to delete session "${title || "Live Session"}"?`)) return;
    try {
      await apiClient.delete(`/api/v1/teacher/meetings/${meetingId}`);
      toast.success("Session deleted successfully.");
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to delete session.");
    }
  };

  React.useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const response = await apiClient.get("/api/v1/teacher/meetings?page=1&page_size=5");
        setMeetings(response.data?.items || []);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };
    fetchMeetings();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Live Classes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Schedule live cohort sessions and office hours.
          </p>
        </div>
        <Button onClick={() => router.push("/teacher/meetings")} size="sm" className="shadow-sm press-scale">
          <Plus className="h-4 w-4 mr-2" />
          Schedule Session
        </Button>
      </div>

      <div className="space-y-4">
        {isLoading && (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-60" />
          </div>
        )}

        {!isLoading && meetings.length === 0 && (
          <div className="p-8 rounded-xl border-2 border-dashed border-border/60 bg-secondary/10 flex flex-col items-center justify-center text-center">
            <CalendarIcon className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <h3 className="text-sm font-semibold text-foreground">No recurring sessions</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              You can set up weekly recurring office hours here.
            </p>
            <Button onClick={() => router.push("/teacher/meetings")} variant="outline" size="sm">Set up recurring</Button>
          </div>
        )}

        {!isLoading && meetings.map((meeting: any) => (
          <div key={meeting.id} className="p-4 rounded-xl border border-border/50 bg-card shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:border-primary/30">
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-semibold text-foreground">{meeting.title || "Live Session"}</h3>
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground mt-2">
                <div className="flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  <span>{meeting.scheduled_at ? format(parseISO(meeting.scheduled_at), "MMMM d, yyyy") : "TBD"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{meeting.scheduled_at ? format(parseISO(meeting.scheduled_at), "h:mm a") : "TBD"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  <span className="capitalize">{meeting.status || "Scheduled"}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => router.push(`/teacher/meetings/${meeting.id}`)} variant="outline" size="sm">Edit</Button>
              <Button onClick={() => handleDeleteMeeting(meeting.id, meeting.title)} variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive border-transparent press-scale">Delete</Button>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-6 border-t border-border flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          Back to Resources
        </Button>
        <Button onClick={nextStep} className="shadow-sm shadow-primary/20 px-8 press-scale">
          Continue to Pricing
        </Button>
      </div>
    </div>
  );
}
