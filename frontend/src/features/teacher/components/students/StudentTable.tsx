"use client";

import * as React from "react";
import { MoreHorizontal, Eye, Mail, Ban, PlayCircle, FolderOpen, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudentStore } from "@/stores/student.store";
import { useTeacherStudents } from "@/hooks/queries/useTeacherQueries";
import { teacherService } from "@/services/teacher.service";
import { queryKeys } from "@/constants/queryKeys";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow, parseISO } from "date-fns";
import type { TeacherStudent } from "@/services/teacher.service";

interface StudentTableProps {
  search?: string;
  status?: string;
  courseId?: string;
}

export function StudentTable({ search, status, courseId }: StudentTableProps) {
  const [page, setPage] = React.useState(1);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { searchQuery, setActiveStudent, selectedStudents, toggleStudentSelection, selectAllStudents, clearSelection } =
    useStudentStore();

  const effectiveSearch = search || searchQuery || undefined;

  // Reset to page 1 whenever filters change
  React.useEffect(() => {
    setPage(1);
  }, [effectiveSearch, status, courseId]);

  const { data, isLoading } = useTeacherStudents(
    { page, pageSize: 20 },
    { search: effectiveSearch, status, courseId } as any,
  );
  const students = data?.items ?? [];

  const toggleAll = () => {
    if (selectedStudents.length === students.length && students.length > 0) {
      clearSelection();
    } else {
      selectAllStudents(students.map((s) => s.id));
    }
  };

  const handleMessage = (email: string) => {
    router.push(`/teacher/communication?email=${encodeURIComponent(email)}`);
  };

  const handleSuspend = async (student: any) => {
    if (student.enrolledCourses > 1) {
      setActiveStudent(student as unknown as Parameters<typeof setActiveStudent>[0]);
      toast.info(`Select a course in the panel to suspend/restore access for ${student.fullName}`);
      return;
    }
    try {
      if (student.status === "SUSPENDED") {
        await teacherService.unsuspendStudent(student.id, student.courseId);
        toast.success(`Access restored for ${student.fullName}`);
      } else {
        await teacherService.suspendStudent(student.id, student.courseId);
        toast.warning(`Access suspended for ${student.fullName}`);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all() });
    } catch (err: any) {
      toast.error(err?.message || "Failed to update student status");
    }
  };

  const handleBlock = async (student: any) => {
    try {
      if (student.status === "SUSPENDED" || !student.is_active) {
        await teacherService.unblockStudent(student.id);
        toast.success(`Account unblocked for ${student.fullName}`);
      } else {
        await teacherService.blockStudent(student.id);
        toast.error(`Account blocked for ${student.fullName}`);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all() });
    } catch (err: any) {
      toast.error(err?.message || "Failed to block student");
    }
  };

  const handleUnenroll = async (student: any) => {
    if (student.enrolledCourses > 1) {
      setActiveStudent(student as unknown as Parameters<typeof setActiveStudent>[0]);
      toast.info(`Select a course in the panel to unenroll ${student.fullName}`);
      return;
    }
    if (!confirm(`Are you sure you want to unenroll ${student.fullName || student.name || 'this student'} from this course?`)) return;
    try {
      await teacherService.unenrollStudent(student.id, student.courseId);
      toast.success(`Unenrolled ${student.fullName || 'student'} from course`);
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all() });
    } catch (err: any) {
      toast.error(err?.message || "Failed to unenroll student");
    }
  };

  function lastActive(student: TeacherStudent) {
    if (!student.lastActiveAt) return "Never";
    try {
      return formatDistanceToNow(parseISO(student.lastActiveAt), { addSuffix: true });
    } catch {
      return "Unknown";
    }
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl elevation-1 bg-white/[0.01] transition-all relative mb-24">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="text-xs font-bold uppercase tracking-widest text-muted-foreground bg-white/5 border-b border-white/5">
            <tr>
              <th scope="col" className="px-4 sm:px-6 py-4 w-[50px]">
                <input 
                  type="checkbox"
                  checked={selectedStudents.length === students.length && students.length > 0}
                  onChange={toggleAll}
                  aria-label="Select all"
                  className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/20 accent-primary cursor-pointer transition-colors hover:border-primary/50"
                />
              </th>
              <th scope="col" className="px-4 sm:px-6 py-4">Student</th>
              <th scope="col" className="px-4 sm:px-6 py-4">Status</th>
              <th scope="col" className="px-4 sm:px-6 py-4">Course &amp; Progress</th>
              <th scope="col" className="px-4 sm:px-6 py-4">Attendance</th>
              <th scope="col" className="px-4 sm:px-6 py-4 hidden sm:table-cell">Last Active</th>
              <th scope="col" className="px-4 sm:px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 sm:px-6 py-4"><Skeleton className="h-4 w-4 rounded bg-white/5" /></td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-full bg-white/5" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-28 bg-white/5" />
                          <Skeleton className="h-3 w-36 bg-white/5" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4"><Skeleton className="h-5 w-16 rounded-full bg-white/5" /></td>
                    <td className="px-4 sm:px-6 py-4"><Skeleton className="h-2 w-32 rounded bg-white/5" /></td>
                    <td className="px-4 sm:px-6 py-4"><Skeleton className="h-4 w-10 bg-white/5" /></td>
                    <td className="px-4 sm:px-6 py-4 hidden sm:table-cell"><Skeleton className="h-4 w-20 bg-white/5" /></td>
                    <td className="px-4 sm:px-6 py-4 text-right"><Skeleton className="h-8 w-8 ml-auto rounded bg-white/5" /></td>
                  </tr>
                ))
              : students.map((student, index) => {
                  const isSelected = selectedStudents.includes(student.id);

                  return (
                    <tr
                      key={student.id ? (student.enrollmentId ? `st-${student.id}-${student.enrollmentId}` : `st-${student.id}-${index}`) : `st-row-${index}`}
                      className={cn(
                        "transition-colors hover:bg-white/[0.02] cursor-pointer group",
                        isSelected && "bg-primary/5 hover:bg-primary/10"
                      )}
                      onClick={() => setActiveStudent(student as unknown as Parameters<typeof setActiveStudent>[0])}
                    >
                      <td className="px-4 sm:px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleStudentSelection(student.id)}
                          aria-label={`Select ${student.fullName}`}
                          className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/20 accent-primary cursor-pointer transition-colors hover:border-primary/50"
                        />
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                          {student.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={student.avatarUrl}
                              alt={student.fullName}
                              className="h-10 w-10 rounded-full ring-2 ring-transparent group-hover:ring-white/10 transition-all object-cover shrink-0"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-white/5 ring-2 ring-transparent group-hover:ring-white/10 transition-all flex items-center justify-center shrink-0">
                              <span className="text-sm font-bold text-muted-foreground/70">
                                {student.fullName[0]}
                              </span>
                            </div>
                          )}
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="font-bold tracking-tight text-foreground line-clamp-1">
                              {student.fullName}
                            </span>
                            <span className="text-xs font-semibold text-muted-foreground line-clamp-1">
                              {student.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-bold tracking-widest text-[9px] uppercase px-2 py-0.5",
                            student.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : student.status === "INACTIVE"
                                ? "bg-white/5 text-muted-foreground border-white/10"
                                : "bg-red-500/10 text-red-400 border-red-500/20"
                          )}
                        >
                          {student.status}
                        </Badge>
                      </td>
                      <td className="px-4 sm:px-6 py-4 min-w-[200px] max-w-[280px]">
                        <div className="flex flex-col gap-1.5 w-full">
                          {student.courseTitle && (
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-xs font-semibold text-foreground line-clamp-1 truncate">{student.courseTitle}</span>
                              {student.enrolledCourses > 1 && (
                                <Badge variant="secondary" className="text-[9px] font-bold px-1.5 py-0 shrink-0 bg-white/10 text-muted-foreground border-none">
                                  {student.enrolledCourses} courses
                                </Badge>
                              )}
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            <span>Progress</span>
                            <span className={student.progressPercent > 80 ? "text-emerald-400" : "text-foreground"}>{student.progressPercent.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.8)] rounded-full transition-all duration-500" 
                              style={{ width: `${student.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 w-28">
                        <span
                          className={`text-sm font-bold ${
                            student.attendancePercent >= 80
                              ? "text-emerald-400"
                              : student.attendancePercent >= 50
                                ? "text-orange-400"
                                : "text-red-400"
                          }`}
                        >
                          {student.attendancePercent.toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-muted-foreground hidden sm:table-cell text-xs font-semibold">
                        {lastActive(student)}
                      </td>
                      <td
                        className="px-4 sm:px-6 py-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-white/10 transition-colors press-scale">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl">
                            <DropdownMenuItem
                              className="font-medium"
                              onClick={() =>
                                setActiveStudent(student as unknown as Parameters<typeof setActiveStudent>[0])
                              }
                            >
                              <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="font-medium"
                              onClick={() => handleMessage(student.email)}
                            >
                              <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                              Message Student
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/5" />
                            <DropdownMenuItem 
                              className="font-medium text-amber-400 focus:text-amber-300 focus:bg-amber-400/10"
                              onClick={() => handleSuspend(student)}
                            >
                              <PlayCircle className="mr-2 h-4 w-4" />
                              {student.status === "SUSPENDED" ? "Restore Access" : "Suspend Access"}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="font-medium text-red-400 focus:text-red-300 focus:bg-red-400/10"
                              onClick={() => handleBlock(student)}
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              {student.status === "SUSPENDED" ? "Unblock Student" : "Block Account"}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="font-medium text-rose-400 focus:text-rose-300 focus:bg-rose-400/10"
                              onClick={() => handleUnenroll(student)}
                            >
                              <UserX className="mr-2 h-4 w-4" />
                              Unenroll Student
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
            {!isLoading && students.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center text-muted-foreground">
                  <p className="font-bold tracking-tight text-foreground text-lg">No students found</p>
                  <p className="text-sm font-medium mt-1">
                    {search ? "Try a different search term." : "Students will appear here when they enroll."}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-white/[0.01]">
          <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total} students
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
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
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
              disabled={!data.hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedStudents.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-2xl border-t border-primary/20 px-6 py-4 flex items-center justify-between animate-in slide-in-from-bottom-full fade-in duration-300 shadow-[0_-10px_40px_-10px_rgba(var(--primary),0.3)]">
          <span className="text-sm font-bold tracking-tight text-primary flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            {selectedStudents.length} student{selectedStudents.length > 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="bg-white/5 border-white/10 hover:bg-white/10 font-semibold h-9 text-xs press-scale">
              <Mail className="h-3.5 w-3.5 mr-2" />
              Message
            </Button>
            <Button variant="outline" size="sm" className="bg-white/5 border-white/10 hover:bg-white/10 font-semibold h-9 text-xs press-scale">
              <FolderOpen className="h-3.5 w-3.5 mr-2" />
              Enroll
            </Button>
            <Button variant="destructive" size="sm" className="font-semibold h-9 text-xs shadow-lg shadow-destructive/20 press-scale">
              Suspend
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
