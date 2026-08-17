"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { 
  X, 
  Video, 
  Clock, 
  Calendar as CalendarIcon, 
  Users, 
  BookOpen, 
  Copy,
  ExternalLink,
  Edit,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useMeetingStore } from "@/stores/meeting.store";

export function MeetingDrawer() {
  const { activeMeeting, setActiveMeeting } = useMeetingStore();

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
                    activeMeeting.status === "Live" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                    activeMeeting.status === "Completed" ? "bg-secondary text-muted-foreground border-border" :
                    activeMeeting.status === "Cancelled" ? "bg-destructive/10 text-destructive border-destructive/20" :
                    "bg-primary/10 text-primary border-primary/20"
                  }
                >
                  {activeMeeting.status === "Live" && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />}
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
                  <span className="font-medium text-sm">{activeMeeting.courseName}</span>
                </div>
              </div>

              {/* Date & Time Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border border-border/50 bg-secondary/20 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium uppercase tracking-wider">Date</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground pl-5">{format(activeMeeting.start, "MMMM d, yyyy")}</p>
                </div>
                <div className="p-3 rounded-lg border border-border/50 bg-secondary/20 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium uppercase tracking-wider">Time</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground pl-5">
                    {format(activeMeeting.start, "h:mm a")} - {format(activeMeeting.end, "h:mm a")}
                  </p>
                </div>
              </div>

              {/* Join Block */}
              {activeMeeting.meetLink && activeMeeting.status !== "Cancelled" && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50 pb-2">Meeting Link</h4>
                  <div className="flex items-center gap-2">
                    <Button className="flex-1 shadow-sm h-11 press-scale" variant={activeMeeting.status === "Live" ? "default" : "secondary"}>
                      <Video className="mr-2 h-4 w-4" />
                      {activeMeeting.status === "Live" ? "Join Meeting Now" : "Join Google Meet"}
                      <ExternalLink className="ml-2 h-3 w-3 opacity-50" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 press-scale" title="Copy Link">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Attendance Block */}
              {activeMeeting.attendance && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> Attendance
                    </h4>
                    <span className="text-xs font-medium text-foreground">
                      {Math.round((activeMeeting.attendance.present / activeMeeting.attendance.total) * 100)}% Present
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <Progress value={(activeMeeting.attendance.present / activeMeeting.attendance.total) * 100} className="h-2" indicatorClassName="bg-primary" />
                    <div className="flex justify-between text-xs font-medium text-muted-foreground">
                      <span><strong className="text-emerald-500">{activeMeeting.attendance.present}</strong> Present</span>
                      <span><strong className="text-destructive">{activeMeeting.attendance.absent}</strong> Absent</span>
                      <span><strong className="text-orange-500">{activeMeeting.attendance.late}</strong> Late</span>
                    </div>
                  </div>
                  
                  <Button variant="link" className="px-0 h-auto text-xs text-primary press-scale">View detailed attendance report</Button>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-border/50 bg-background/50 flex items-center gap-2">
              <Button variant="outline" className="flex-1 shadow-sm press-scale">
                <Edit className="mr-2 h-4 w-4" />
                Edit Details
              </Button>
              <Button variant="outline" className="flex-1 shadow-sm text-destructive hover:bg-destructive/10 hover:text-destructive border-transparent press-scale">
                <Trash2 className="mr-2 h-4 w-4" />
                Cancel Session
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
