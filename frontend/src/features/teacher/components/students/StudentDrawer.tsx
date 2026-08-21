"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Mail, 
  TrendingUp,
  Clock,
  BookOpen,
  DollarSign,
  UserX,
  PlayCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useStudentStore } from "@/stores/student.store";
import { useRouter } from "next/navigation";
import { teacherService } from "@/services/teacher.service";
import { queryKeys } from "@/constants/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActivityTimeline } from "./ActivityTimeline";

export function StudentDrawer() {
  const { activeStudent, setActiveStudent } = useStudentStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [fullStudent, setFullStudent] = React.useState<any>(null);
  const [unenrollingCourseId, setUnenrollingCourseId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (activeStudent?.id) {
      teacherService
        .getStudent(activeStudent.id)
        .then((res) => setFullStudent(res))
        .catch(() => setFullStudent(null));
    } else {
      setFullStudent(null);
    }
  }, [activeStudent?.id]);

  const enrollmentsList = React.useMemo(() => {
    if (!activeStudent) return [];
    if (fullStudent?.enrollments && Array.isArray(fullStudent.enrollments) && fullStudent.enrollments.length > 0) {
      return fullStudent.enrollments;
    }
    if (activeStudent?.enrollments && Array.isArray(activeStudent.enrollments) && activeStudent.enrollments.length > 0) {
      return activeStudent.enrollments;
    }
    if (typeof activeStudent?.courseTitle === "string" && activeStudent.courseTitle.includes(",")) {
      const titles = activeStudent.courseTitle.split(",").map((t: string) => t.trim());
      return titles.map((t: string, idx: number) => ({
        course_id: activeStudent.courseId || `c-${idx}`,
        course_title: t,
        progress_percent: activeStudent.progressPercent || activeStudent.progress || 0,
      }));
    }
    return [
      {
        course_id: activeStudent?.courseId,
        course_title: activeStudent?.courseTitle || "Enrolled Course",
        progress_percent: activeStudent?.progressPercent || activeStudent?.progress || 0,
      },
    ];
  }, [fullStudent, activeStudent]);

  if (!activeStudent) return null;

  const fullName = activeStudent.fullName || activeStudent.name || "Student";
  const email = activeStudent.email || "";
  const avatar = activeStudent.avatarUrl || activeStudent.avatar;
  const progress = Number(activeStudent.progressPercent ?? activeStudent.progress ?? 0);
  const attendance = Number(activeStudent.attendancePercent ?? activeStudent.attendance ?? 95);
  const revenue = Number(activeStudent.totalRevenue ?? activeStudent.revenue ?? 0);
  const courseTitle = activeStudent.courseTitle || "Enrolled Course";
  const status = activeStudent.status || "ACTIVE";

  const handleMessage = () => {
    setActiveStudent(null);
    router.push(`/teacher/communication?email=${encodeURIComponent(email)}`);
  };

  const handleUnenrollCourse = async (targetCourseId: string, targetCourseTitle: string) => {
    if (!targetCourseId) {
      toast.error("Course ID not found");
      return;
    }
    if (!confirm(`Are you sure you want to unenroll ${fullName} from "${targetCourseTitle}"?`)) return;

    setUnenrollingCourseId(targetCourseId);
    try {
      await teacherService.unenrollStudent(activeStudent.id, targetCourseId);
      toast.success(`Unenrolled ${fullName} from "${targetCourseTitle}" successfully.`);
      
      if (fullStudent) {
        setFullStudent((prev: any) => ({
          ...prev,
          enrollments: (prev?.enrollments || []).filter((e: any) => (e.course_id || e.courseId) !== targetCourseId),
        }));
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.students.all() });
    } catch (err: any) {
      toast.error(err?.message || "Failed to unenroll student");
    } finally {
      setUnenrollingCourseId(null);
    }
  };

  const handleToggleSuspendCourse = async (targetCourseId: string, targetCourseTitle: string, isSuspended: boolean) => {
    if (!targetCourseId) return;
    try {
      if (isSuspended) {
        await teacherService.unsuspendStudent(activeStudent.id, targetCourseId);
        toast.success(`Restored access for ${fullName} in "${targetCourseTitle}"`);
      } else {
        await teacherService.suspendStudent(activeStudent.id, targetCourseId);
        toast.warning(`Suspended access for ${fullName} in "${targetCourseTitle}"`);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all() });
      if (fullStudent) {
        setFullStudent((prev: any) => ({
          ...prev,
          enrollments: (prev?.enrollments || []).map((e: any) =>
            (e.course_id || e.courseId) === targetCourseId
              ? { ...e, status: isSuspended ? "ACTIVE" : "SUSPENDED" }
              : e
          ),
        }));
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status");
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
        onClick={() => setActiveStudent(null)}
      />

      <motion.div
        initial={{ x: "100%", boxShadow: "none" }}
        animate={{ x: 0, boxShadow: "-10px 0 30px rgba(0,0,0,0.1)" }}
        exit={{ x: "100%", boxShadow: "none" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed inset-y-0 right-0 w-full sm:w-[500px] md:w-[600px] bg-card border-l border-border z-50 flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/50">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                "bg-destructive/10 text-destructive border-destructive/20"
              }
            >
              {status}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full press-scale" onClick={() => setActiveStudent(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Profile Cover & Header */}
          <div className="relative h-32 bg-gradient-to-r from-primary/20 to-primary/5 border-b border-border/50">
            <div className="absolute -bottom-10 left-6">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt={fullName} className="h-20 w-20 rounded-full border-4 border-card bg-secondary object-cover shadow-sm" />
              ) : (
                <div className="h-20 w-20 rounded-full border-4 border-card bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl">
                  {fullName[0]}
                </div>
              )}
            </div>
            <div className="absolute bottom-4 right-6 flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleMessage} className="h-8 bg-background/50 backdrop-blur shadow-sm press-scale">
                <Mail className="mr-2 h-4 w-4" />
                Message
              </Button>
            </div>
          </div>

          <div className="px-6 pt-12 pb-6 space-y-8">
            {/* Personal Info */}
            <div>
              <h2 className="text-2xl font-bold text-foreground">{fullName}</h2>
              <p className="text-sm text-muted-foreground">{email}</p>
              
              <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> Active Student</span>
                {revenue > 0 && <span className="flex items-center gap-1.5"><DollarSign className="h-4 w-4" /> ${revenue} Paid</span>}
              </div>
            </div>

            {/* High Level Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg border border-border/50 bg-secondary/20 flex flex-col justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg Progress</span>
                <span className="text-lg font-bold text-foreground mt-1">{progress.toFixed(0)}%</span>
              </div>
              <div className="p-3 rounded-lg border border-border/50 bg-secondary/20 flex flex-col justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attendance</span>
                <span className="text-lg font-bold text-foreground mt-1">{attendance.toFixed(0)}%</span>
              </div>
              <div className="p-3 rounded-lg border border-border/50 bg-secondary/20 flex flex-col justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</span>
                <span className="text-sm font-bold text-emerald-500 mt-1 uppercase">{status}</span>
              </div>
            </div>

            {/* Course Enrollments */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" /> Enrolled Courses ({enrollmentsList.length})
              </h4>
              <div className="space-y-3">
                {enrollmentsList.map((item: any, idx: number) => {
                  const cTitle = item.course_title || item.courseTitle || courseTitle;
                  const cId = item.course_id || item.courseId || item.id || activeStudent?.courseId;
                  const cProgress = Number(item.progress_percent ?? item.progressPercent ?? progress);
                  const isUnenrollingThis = unenrollingCourseId === cId;
                  const isCourseSuspended = item.status === "SUSPENDED" || item.enrollment_status === "SUSPENDED";
                  const itemKey = `drawer-course-${cId || 'noid'}-${item.enrollment_id || item.id || 'noid'}-${idx}`;

                  return (
                    <div
                      key={itemKey}
                      className="p-4 rounded-xl border border-border/50 bg-background shadow-sm hover:border-primary/20 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <span className="font-semibold text-sm line-clamp-1 text-foreground">{cTitle}</span>
                        {cId && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleSuspendCourse(cId, cTitle, isCourseSuspended)}
                              className={`h-7 text-xs px-2.5 rounded-lg ${
                                isCourseSuspended
                                  ? "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                                  : "text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10"
                              }`}
                            >
                              <PlayCircle className="mr-1 h-3.5 w-3.5" />
                              {isCourseSuspended ? "Restore" : "Suspend"}
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isUnenrollingThis}
                              onClick={() => handleUnenrollCourse(cId, cTitle)}
                              className="h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2.5 rounded-lg"
                            >
                              <UserX className="mr-1 h-3.5 w-3.5" />
                              {isUnenrollingThis ? "Unenrolling..." : "Unenroll"}
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 w-full mt-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{cProgress.toFixed(0)}% Completed</span>
                        </div>
                        <Progress value={cProgress} className="h-1.5" indicatorClassName="bg-primary" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-6">
                <TrendingUp className="h-4 w-4 text-primary" /> Activity History
              </h4>
              <ActivityTimeline studentId={activeStudent.id} />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
