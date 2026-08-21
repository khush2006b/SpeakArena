"use client";

import React, { useState, useEffect } from "react";
import { 
  ClipboardCheck, ExternalLink, Calendar, Clock, Lock, CheckCircle2, 
  Trophy, BookOpen, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { testService, StudentTest } from "@/services/test.service";

export default function StudentTestsPage() {
  const [tests, setTests] = useState<StudentTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTests = async () => {
    try {
      setIsLoading(true);
      const data = await testService.listStudentTests();
      setTests(data);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load tests");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, []);

  const handleOpenTest = (t: StudentTest) => {
    if (!t.isOpen || !t.googleFormUrl) {
      toast.error("Test link is currently closed");
      return;
    }
    window.open(t.googleFormUrl, "_blank", "noopener,noreferrer");
  };

  const openCount = tests.filter((t) => t.isOpen).length;
  const gradedCount = tests.filter((t) => t.isGraded).length;

  return (
    <div className="space-y-8 pb-20">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-white/10 shadow-xl">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">My Course Tests</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            Access tests for your enrolled courses during open window times and view your scores and teacher feedback.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Open Now</span>
            <span className="text-lg font-extrabold text-emerald-400">{openCount}</span>
          </div>
          <div className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Graded</span>
            <span className="text-lg font-extrabold text-primary">{gradedCount}</span>
          </div>
        </div>
      </div>

      {/* Tests List */}
      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">Loading your tests...</div>
      ) : tests.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl space-y-3">
          <BookOpen className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="font-bold text-foreground text-lg">No Tests Scheduled</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            When your teachers schedule online tests for your enrolled courses, they will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {tests.map((t) => {
            const pct = t.isGraded && t.maxScore ? Math.round(((t.score || 0) / t.maxScore) * 100) : 0;

            return (
              <div
                key={t.id}
                className="group p-6 rounded-2xl border border-white/10 bg-white/[0.01] hover:border-primary/30 transition-all duration-300 shadow-md space-y-5"
              >
                {/* Top Info */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold">
                        {t.courseTitle}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          t.status === "OPEN"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : t.status === "UPCOMING"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        }
                      >
                        {t.status === "OPEN" ? "🟢 OPEN NOW" : t.status === "UPCOMING" ? "⏳ UPCOMING" : "🔴 CLOSED"}
                      </Badge>
                    </div>

                    <h2 className="text-xl font-bold text-foreground mt-2">{t.title}</h2>
                    {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                  </div>

                  {/* Open Test Action Button */}
                  <div className="shrink-0">
                    {t.isOpen ? (
                      <Button
                        onClick={() => handleOpenTest(t)}
                        className="h-11 px-6 font-bold rounded-xl shadow-lg press-scale bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" /> Open Test (Google Form)
                      </Button>
                    ) : t.status === "UPCOMING" ? (
                      <Button disabled variant="outline" className="h-11 px-5 rounded-xl border-amber-500/30 text-amber-400">
                        <Lock className="mr-2 h-4 w-4" /> Opens at {new Date(t.startTime).toLocaleString()}
                      </Button>
                    ) : (
                      <Button disabled variant="outline" className="h-11 px-5 rounded-xl border-white/10 text-muted-foreground">
                        <Lock className="mr-2 h-4 w-4" /> Test Window Closed
                      </Button>
                    )}
                  </div>
                </div>

                {/* Time Window Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground bg-white/[0.02] p-3 rounded-xl border border-white/5">
                  <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-primary" /> Start: {new Date(t.startTime).toLocaleString()}</span>
                  <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-rose-400" /> End: {new Date(t.endTime).toLocaleString()}</span>
                  <span className="flex items-center gap-1.5"><ClipboardCheck className="h-3.5 w-3.5 text-amber-400" /> Max Score: {t.maxScore} pts</span>
                </div>

                {/* Grade & Feedback Card */}
                {t.isGraded ? (
                  <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                        <Trophy className="h-4 w-4" /> Grade Result
                      </div>
                      <span className="text-lg font-extrabold text-foreground">
                        {t.score} / {t.maxScore} <span className="text-xs font-normal text-muted-foreground">({pct}%)</span>
                      </span>
                    </div>

                    {t.feedback && (
                      <div className="flex items-start gap-2 text-xs text-muted-foreground pt-1">
                        <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <span><strong className="text-foreground">Teacher Remarks:</strong> {t.feedback}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-white/5 bg-white/[0.01] text-xs text-muted-foreground flex items-center justify-between">
                    <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-muted-foreground/60" /> Status: Submitted / Pending Teacher Grade</span>
                    <span className="italic">Not Graded Yet</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
