"use client";

import * as React from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { 
  MoreVertical, 
  Mail, 
  Eye,
  Activity,
  Loader2,
  Users,
  UserX
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStudentStore } from "@/stores/student.store";
import { useTeacherStudents } from "@/hooks/queries/useTeacherQueries";
import { teacherService } from "@/services/teacher.service";
import { queryKeys } from "@/constants/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function StudentCard({ student }: { student: any }) {
  const { setActiveStudent } = useStudentStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const isActive = student.status === "ACTIVE";
  const isSuspended = student.status === "SUSPENDED";
  const fullName = student.fullName || student.name || "Student";
  const progress = Number(student.progressPercent ?? student.averageProgress ?? 0);
  const attendance = Number(student.attendancePercent ?? student.averageAttendance ?? 95);

  const handleMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/teacher/communication?email=${encodeURIComponent(student.email || "")}`);
  };

  const handleUnenroll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (student.enrolledCourses > 1) {
      setActiveStudent(student);
      toast.info(`Select a course in the panel to unenroll ${fullName}`);
      return;
    }
    if (!confirm(`Are you sure you want to unenroll ${fullName} from this course?`)) return;
    try {
      await teacherService.unenrollStudent(student.id, student.courseId);
      toast.success(`Unenrolled ${fullName} from course successfully`);
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all() });
    } catch (err: any) {
      toast.error(err?.message || "Failed to unenroll student");
    }
  };

  return (
    <div 
      className={cn(
        "group elevation-1 rounded-2xl overflow-hidden transition-all duration-300 hover:elevation-2 flex flex-col h-full cursor-pointer relative bg-white/[0.01]",
        isSuspended && "opacity-70 grayscale-[0.5]"
      )} 
      onClick={() => setActiveStudent(student)}
    >
      <div className="absolute right-3 top-3 z-10" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors opacity-100 focus:opacity-100">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl">
            <DropdownMenuItem onClick={() => setActiveStudent(student)} className="font-medium">
              <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
              View Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleMessage} className="font-medium">
              <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
              Message
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleUnenroll} className="font-medium text-rose-400 focus:text-rose-300 focus:bg-rose-400/10">
              <UserX className="mr-2 h-4 w-4" />
              Unenroll Student
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="p-6 flex-1 flex flex-col items-center text-center">
        <div className="relative mb-4">
          {student.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={student.avatarUrl} alt={fullName} className="h-20 w-20 rounded-full ring-2 ring-background shadow-lg object-cover" />
          ) : (
            <div className="h-20 w-20 rounded-full ring-2 ring-background shadow-lg bg-primary/10 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">{fullName[0]}</span>
            </div>
          )}
          <div className={cn(
            "absolute bottom-1 right-1 h-4 w-4 rounded-full ring-2 ring-background shadow-[0_0_10px_rgba(0,0,0,0.5)]",
            isActive ? "bg-emerald-500 shadow-emerald-500/50" : isSuspended ? "bg-red-500" : "bg-muted"
          )} />
        </div>

        <h3 className="font-bold tracking-tight text-foreground line-clamp-1">{fullName}</h3>
        <p className="text-xs font-medium text-muted-foreground line-clamp-1 mt-1">{student.email}</p>
        {student.courseTitle && (
          <Badge variant="outline" className="mt-2 text-[10px] bg-white/5 border-white/10 text-muted-foreground truncate max-w-full">
            {student.courseTitle}
          </Badge>
        )}

        <div className="w-full mt-6 space-y-4">
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <span>Progress</span>
              <span className={progress > 80 ? "text-emerald-400" : "text-foreground"}>{progress.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.8)] rounded-full transition-all duration-500" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <span>Attendance</span>
              <span className={attendance < 50 ? "text-red-400" : "text-foreground"}>{attendance.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div 
                className={cn("h-full rounded-full transition-all duration-500 shadow-[0_0_10px_currentColor]", attendance < 50 ? "bg-red-500 text-red-500" : "bg-emerald-500 text-emerald-500")}
                style={{ width: `${attendance}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-semibold">
          <Activity className="h-3.5 w-3.5" />
          {student.lastActiveAt ? formatDistanceToNow(parseISO(student.lastActiveAt), { addSuffix: true }) : "Recent"}
        </span>
        <Badge variant="outline" className="font-bold text-[9px] uppercase tracking-widest px-2 bg-white/5 border-white/10">Active</Badge>
      </div>
    </div>
  );
}

export function StudentGrid() {
  const searchQuery = useStudentStore((state) => state.searchQuery);
  const [page, setPage] = React.useState(1);
  const { data, isLoading } = useTeacherStudents(
    { page, pageSize: 20 },
    { search: searchQuery || undefined } as any
  );
  const students = data?.items ?? [];

  // Reset to page 1 when search changes
  React.useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24 elevation-1 rounded-2xl bg-white/[0.01]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/30" />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center elevation-1 rounded-2xl bg-white/[0.01]">
        <div className="h-16 w-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
          <Users className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="font-bold tracking-tight text-lg mb-1">No Students Found</h3>
        <p className="text-sm font-medium text-muted-foreground">
          {searchQuery ? "Try a different search term." : "When students enroll in your courses, they will appear here."}
        </p>
      </div>
    );
  }

  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? students.length;
  const start = (page - 1) * 20 + 1;
  const end = Math.min(page * 20, total);

  return (
    <div className="pb-24">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 mb-6">
        {students.map((student, index) => (
          <StudentCard key={student.id ? (student.enrollmentId ? `st-card-${student.id}-${student.enrollmentId}` : `st-card-${student.id}-${index}`) : `st-card-idx-${index}`} student={student} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-4 border-t border-white/5">
          <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground">
            Showing {start}–{end} of {total} students
          </span>
          <div className="flex items-center gap-2">
            <button
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-40 transition-colors"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 text-sm font-bold rounded-lg transition-colors ${
                    p === page
                      ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsla(270,80%,60%,0.4)]"
                      : "border border-white/10 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-40 transition-colors"
              disabled={!data?.hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

