"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Download,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Video
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAnalyticsStore } from "@/stores/analytics.store";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export default function ReportDrawer() {
  const { activeReportUser, setActiveReportUser } = useAnalyticsStore();

  return (
    <AnimatePresence>
      {activeReportUser && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={() => setActiveReportUser(null)}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%", boxShadow: "none" }}
            animate={{ x: 0, boxShadow: "-20px 0 50px rgba(0,0,0,0.5)" }}
            exit={{ x: "100%", boxShadow: "none" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full sm:w-[500px] md:w-[600px] bg-background/95 backdrop-blur-2xl border-l border-white/10 z-50 flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-widest uppercase text-foreground">Performance Report</span>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" className="h-9 border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold tracking-wider press-scale">
                  <Download className="mr-2 h-4 w-4" /> PDF
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-white/10 transition-colors press-scale" onClick={() => setActiveReportUser(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Profile Card */}
              <div className="flex items-center gap-5 p-5 rounded-2xl elevation-1 bg-white/[0.02] border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 h-32 w-32 bg-primary/10 rounded-full blur-3xl -z-10" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={activeReportUser.avatar} alt={activeReportUser.name} className="h-16 w-16 rounded-full border border-white/10 object-cover shadow-lg" />
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-extrabold tracking-tight text-foreground">{activeReportUser.name}</h2>
                  <p className="text-sm font-semibold text-muted-foreground opacity-80">{activeReportUser.course}</p>
                </div>
                <div className="ml-auto">
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-bold tracking-widest text-[10px] uppercase px-3 py-1",
                      activeReportUser.riskLevel === "Low" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]" :
                      activeReportUser.riskLevel === "Medium" ? "bg-orange-500/10 text-orange-400 border-orange-500/20 shadow-[0_0_10px_rgba(251,146,60,0.1)]" :
                      "bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_15px_rgba(248,113,113,0.3)] animate-pulse"
                    )}
                  >
                    {activeReportUser.riskLevel === "High" && <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />}
                    {activeReportUser.riskLevel} Risk
                  </Badge>
                </div>
              </div>

              {/* Attendance Breakdown Donut */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl elevation-1 bg-white/[0.01] border border-white/5 space-y-6 flex flex-col">
                  <h3 className="text-sm font-bold tracking-widest uppercase text-muted-foreground">Attendance</h3>
                  <div className="h-[160px] w-full relative flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Present", value: activeReportUser.present, color: "hsl(var(--emerald-500))" },
                            { name: "Late", value: activeReportUser.late, color: "hsl(var(--orange-500))" },
                            { name: "Absent", value: activeReportUser.absent, color: "hsl(var(--destructive))" },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={4}
                          dataKey="value"
                          stroke="none"
                          cornerRadius={4}
                        >
                          {
                            [
                              { color: "hsl(var(--emerald-500))" },
                              { color: "hsl(var(--orange-500))" },
                              { color: "hsl(var(--destructive))" }
                            ].map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} style={{ filter: `drop-shadow(0px 0px 8px ${entry.color}40)` }} />)
                          }
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                      <span className="text-2xl font-extrabold tracking-tighter drop-shadow-sm">{activeReportUser.attendancePercent}%</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs mt-2 border-t border-white/5 pt-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-base font-extrabold text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">{activeReportUser.present}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Present</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-base font-extrabold text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]">{activeReportUser.late}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Late</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-base font-extrabold text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]">{activeReportUser.absent}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Absent</span>
                    </div>
                  </div>
                </div>

                {/* Progress & Time */}
                <div className="space-y-6">
                  <div className="p-5 rounded-2xl elevation-1 bg-white/[0.01] border border-white/5 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" /> Watch Time
                    </h3>
                    <div className="text-3xl font-extrabold text-foreground drop-shadow-sm">{activeReportUser.watchTime}</div>
                    <p className="text-[11px] font-semibold text-muted-foreground opacity-70">Total hours consumed this semester</p>
                  </div>
                  
                  <div className="p-5 rounded-2xl elevation-1 bg-white/[0.01] border border-white/5 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                      <span>Course Progress</span>
                      <span className="text-primary font-extrabold text-sm">{activeReportUser.progressPercent}%</span>
                    </h3>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden mt-2">
                      <div className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.8)] rounded-full transition-all duration-1000" style={{ width: `${activeReportUser.progressPercent}%` }} />
                    </div>
                    <p className="text-[11px] font-semibold text-muted-foreground opacity-70">Based on completed assignments</p>
                  </div>
                </div>
              </div>

              {/* Meeting Participation */}
              <div className="space-y-4 pt-4">
                <h3 className="text-sm font-bold tracking-widest uppercase text-muted-foreground">Recent Sessions</h3>
                <div className="space-y-3">
                  {[
                    { title: "System Design Q&A", date: "Today", status: "present" },
                    { title: "CAP Theorem Workshop", date: "2 days ago", status: "late" },
                    { title: "Database Sharding", date: "Last week", status: "absent" }
                  ].map((meeting, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl elevation-1 bg-white/[0.02] border border-transparent hover:border-white/5 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-[inset_0_1px_1px_hsl(var(--border))]">
                          <Video className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold tracking-tight text-foreground">{meeting.title}</span>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground opacity-70">{meeting.date}</span>
                        </div>
                      </div>
                      <div>
                        {meeting.status === "present" && <CheckCircle2 className="h-5 w-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />}
                        {meeting.status === "late" && <Clock className="h-5 w-5 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]" />}
                        {meeting.status === "absent" && <XCircle className="h-5 w-5 text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
