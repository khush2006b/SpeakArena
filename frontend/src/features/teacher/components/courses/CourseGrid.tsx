"use client";

import * as React from "react";
import { Users, PlayCircle, MoreHorizontal, Loader2, Trash2, Archive, FileEdit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useTeacherCourses,
  useDeleteCourse,
  useUpdateCourse,
} from "@/hooks/queries/useTeacherQueries";
import type { Course } from "@/types";
import { format } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";

function CourseCardSkeleton() {
  return (
    <div className="elevation-1 rounded-2xl overflow-hidden flex flex-col h-full bg-background/50">
      <Skeleton className="aspect-video w-full bg-white/5 rounded-none" />
      <div className="p-5 flex-1 flex flex-col">
        <div className="space-y-3">
          <Skeleton className="h-5 w-3/4 bg-white/5" />
          <Skeleton className="h-4 w-16 bg-white/5" />
        </div>
        <div className="mt-auto pt-6 space-y-4">
          <Skeleton className="h-4 w-full bg-white/5" />
          <Skeleton className="h-2 w-full bg-white/5" />
        </div>
      </div>
    </div>
  );
}

function CourseCard({ course }: { course: Course }) {
  const isDraft = course.status === "DRAFT";
  const isArchived = course.status === "ARCHIVED";
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const deleteMutation = useDeleteCourse();
  const updateMutation = useUpdateCourse();

  const handleDelete = () => {
    deleteMutation.mutate(course.id, {
      onSuccess: () => {
        toast.success(`Course "${course.title}" was deleted.`);
        setIsDeleteDialogOpen(false);
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to delete course.");
      },
    });
  };

  return (
    <>
      <div className="group elevation-1 rounded-2xl overflow-hidden transition-all duration-300 hover:elevation-2 flex flex-col h-full relative">
        {/* Thumbnail */}
        <div className="relative aspect-video w-full overflow-hidden bg-white/5">
          {course.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <span className="text-4xl font-extrabold text-muted-foreground/30">{course.title[0]}</span>
            </div>
          )}
          <div className="absolute right-3 top-3 z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/50 backdrop-blur-md border border-white/10 text-foreground hover:bg-white/10 transition-colors opacity-100 focus:opacity-100">
                  {deleteMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoreHorizontal className="h-4 w-4" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl">
                <DropdownMenuItem className="font-medium" asChild>
                  <Link href={`/teacher/builder?courseId=${course.id}`}>
                    <FileEdit className="mr-2 h-4 w-4 text-muted-foreground" />
                    Edit Course
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/5" />
                {!isArchived && (
                  <DropdownMenuItem
                    className="font-medium text-amber-400 focus:text-amber-300 focus:bg-amber-400/10"
                    onClick={() => updateMutation.mutate({ id: course.id, status: "ARCHIVED" })}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive Course
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-red-400 focus:text-red-300 focus:bg-red-400/10 font-medium"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Course
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        {!isDraft && !isArchived && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.6)] transform scale-90 group-hover:scale-100 transition-transform duration-300">
              <PlayCircle className="h-6 w-6" />
            </div>
          </div>
        )}
        
        {/* Ambient overlay gradient for blending the image into the card content slightly */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background to-transparent pointer-events-none opacity-80" />
      </div>

      <div className="p-5 flex-1 flex flex-col relative z-10 -mt-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h3 className="font-bold text-lg line-clamp-2 leading-tight text-foreground tracking-tight drop-shadow-sm">
            {course.title}
          </h3>
        </div>

        <div className="mb-4">
          <Badge
            variant={isDraft ? "outline" : "default"}
            className={cn(
              "font-bold tracking-widest text-[9px] uppercase px-2",
              isDraft
                ? "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border-orange-500/20 whitespace-nowrap"
                : isArchived
                  ? "bg-white/5 text-muted-foreground hover:bg-white/10 whitespace-nowrap border-white/10"
                  : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20 whitespace-nowrap"
            )}
          >
            {course.status}
          </Badge>
        </div>

        <div className="mt-auto space-y-4 pt-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="font-extrabold text-foreground tracking-tight">
              {course.price === 0 ? "Free" : `₹${course.price.toLocaleString("en-IN")}`}
            </span>
            <div className="flex items-center gap-1.5 font-semibold">
              <Users className="h-4 w-4 text-violet-400" />
              <span className="text-xs">
                {(course.enrolledCount ?? (course as any).total_enrollments ?? 0).toLocaleString()} / {course.maxStudents ?? (course as any).max_students ?? 50} seats
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Completion</span>
              <span className="text-foreground">
                {((course as any).completionRate ?? 0).toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.8)] rounded-full transition-all duration-500" 
                style={{ width: `${(course as any).completionRate ?? 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 pt-4 text-xs font-semibold text-muted-foreground border-t border-white/5 flex items-center justify-between bg-white/[0.01]">
        <span>
          Updated{" "}
          {course.updatedAt
            ? format(new Date(course.updatedAt), "MMM d, yyyy")
            : "—"}
        </span>
      </div>
    </div>

    <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Course?
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong className="text-foreground">"{course.title}"</strong>? This will soft-delete the course and hide it from all listings.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="min-w-[120px]"
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Confirm Delete"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

export function CourseGrid({
  search,
  status,
}: {
  search?: string;
  status?: string;
}) {
  const [page, setPage] = React.useState(1);
  const { data, isLoading, isError, error } = useTeacherCourses(
    { page, pageSize: 12 },
    { search, status } as any,
  );
  const courses = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => <CourseCardSkeleton key={i} />)}
      </div>
    );
  }

  if (isError) {
    const msg = (error as any)?.message ?? "Failed to load courses. Make sure the backend is running.";
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center elevation-1 rounded-2xl bg-white/[0.01] border border-red-500/20">
        <PlayCircle className="h-12 w-12 text-red-500/40 mb-4" />
        <p className="text-lg font-bold tracking-tight text-foreground">Could not load courses</p>
        <p className="text-sm text-muted-foreground mt-1 font-medium max-w-sm">{msg}</p>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center elevation-1 rounded-2xl bg-white/[0.01]">
        <PlayCircle className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="text-lg font-bold tracking-tight text-foreground">No courses found</p>
        <p className="text-sm text-muted-foreground mt-1 font-medium">
          {search ? "Try a different search term." : "Create your first course to get started."}
        </p>
        {!search && (
          <Link
            href="/teacher/builder"
            className="mt-4 px-5 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Create Course
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {courses.map((course, idx) => (
          <CourseCard key={course.id ? `${course.id}-${idx}` : `teacher-course-${idx}`} course={course} />
        ))}
      </div>
      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-3 pt-4">
          <button
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50 transition-colors"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm font-bold tracking-widest text-muted-foreground uppercase flex items-center">
            Page {page} of {data.totalPages}
          </span>
          <button
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50 transition-colors"
            disabled={!data.hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
