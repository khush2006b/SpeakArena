"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { 
  X, 
  Video, 
  Clock, 
  Calendar as CalendarIcon, 
  BookOpen, 
  Copy,
  ExternalLink,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMeetingStore } from "@/stores/meeting.store";
import { useDeleteMeeting } from "@/hooks/queries/useTeacherQueries";
import { toast } from "sonner";

export function MeetingDrawer() {
  const { activeMeeting, setActiveMeeting } = useMeetingStore();

  const deleteMeetingMutation = useDeleteMeeting();

  if (!activeMeeting) return null;

  const startDate = activeMeeting.start ? new Date(activeMeeting.start) : new Date();
  const endDate = activeMeeting.end ? new Date(activeMeeting.end) : new Date();

  const handleCopyLink = () => {
    const link = activeMeeting.meetLink || `https://meet.google.com/${activeMeeting.id}`;
    navigator.clipboard.writeText(link);
    toast.success("Meeting link copied to clipboard!");
  };

  const handleCancelMeeting = () => {
    if (!confirm(`Are you sure you want to cancel session "${activeMeeting.title}"?`)) return;

    deleteMeetingMutation.mutate(activeMeeting.id, {
      onSuccess: () => {
        toast.success("Meeting cancelled.");
        setActiveMeeting(null);
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || "Failed to cancel meeting.");
      },
    });
  };

  return (
    <AnimatePresence>
      {activeMeeting && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={() => setActiveMeeting(null)}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%", boxShadow: "none" }}
            animate={{ x: 0, boxShadow: "-10px 0 30px rgba(0,0,0,0.1)" }}
            exit={{ x: "100%", boxShadow: "none" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-card border-l border-border z-50 flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/50">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    activeMeeting.status === "Live" || activeMeeting.status === "LIVE" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                    activeMeeting.status === "Completed" || activeMeeting.status === "ENDED" ? "bg-secondary text-muted-foreground border-border" :
                    activeMeeting.status === "Cancelled" || activeMeeting.status === "CANCELLED" ? "bg-destructive/10 text-destructive border-destructive/20" :
                    "bg-primary/10 text-primary border-primary/20"
                  }
                >
                  {(activeMeeting.status === "Live" || activeMeeting.status === "LIVE") && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />}
                  {activeMeeting.status}
                </Badge>
                {activeMeeting.isRecurring && (
                  <Badge variant="secondary">Recurring</Badge>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full press-scale" onClick={() => setActiveMeeting(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Title Block */}
              <div>
                <h2 className="text-2xl font-bold text-foreground leading-tight">
                  {activeMeeting.title}
                </h2>
                <div className="flex items-center gap-2 mt-2 text-primary">
                  <BookOpen className="h-4 w-4" />
                  <span className="font-medium text-sm">{activeMeeting.courseName || "Course Session"}</span>
                </div>
              </div>

              {/* Date & Time Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border border-border/50 bg-secondary/20 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium uppercase tracking-wider">Date</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground pl-5">{format(startDate, "MMMM d, yyyy")}</p>
                </div>
                <div className="p-3 rounded-lg border border-border/50 bg-secondary/20 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium uppercase tracking-wider">Time</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground pl-5">
                    {format(startDate, "h:mm a")} - {format(endDate, "h:mm a")}
                  </p>
                </div>
              </div>

              {/* Join Block */}
              {activeMeeting.status !== "Cancelled" && activeMeeting.status !== "CANCELLED" && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50 pb-2">Google Meet Access</h4>
                  <div className="flex items-center gap-2">
                    <a
                      href={activeMeeting.meetLink || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/25 transition-all press-scale"
                    >
                      <Video className="h-4 w-4" />
                      Join Google Meet Class
                      <ExternalLink className="h-3.5 w-3.5 opacity-70 ml-auto" />
                    </a>
                    <Button variant="outline" size="icon" onClick={handleCopyLink} className="h-11 w-11 shrink-0 press-scale" title="Copy Link">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-border/50 bg-background/50 flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleCancelMeeting}
                disabled={deleteMeetingMutation.isPending}
                className="w-full shadow-sm text-destructive hover:bg-destructive/10 hover:text-destructive border-transparent press-scale"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deleteMeetingMutation.isPending ? "Deleting..." : "Delete Session"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
