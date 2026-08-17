"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStudentStore } from "@/stores/student.store";
import { useTeacherCourses } from "@/hooks/queries/useTeacherQueries";
import { apiClient } from "@/services/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { toast } from "sonner";
import { Loader2, UserPlus, CheckCircle2 } from "lucide-react";

export function AddStudentModal() {
  const { isAddModalOpen, setAddModalOpen } = useStudentStore();
  const queryClient = useQueryClient();

  const [directoryStudents, setDirectoryStudents] = React.useState<any[]>([]);
  const [isLoadingDirectory, setIsLoadingDirectory] = React.useState(false);

  const [selectedStudentId, setSelectedStudentId] = React.useState<string>("");
  const [selectedCourseId, setSelectedCourseId] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const { data: coursesData } = useTeacherCourses({ page: 1, pageSize: 100 });
  const courses = coursesData?.items ?? [];

  React.useEffect(() => {
    if (isAddModalOpen) {
      setIsLoadingDirectory(true);
      apiClient
        .get("/api/v1/teacher/all-students", { params: { page_size: 100 } })
        .then(({ data }) => {
          const raw = data.data ?? data;
          const items = Array.isArray(raw) ? raw : (raw.items ?? []);
          setDirectoryStudents(items);
        })
        .catch(() => {
          toast.error("Failed to load student directory");
        })
        .finally(() => {
          setIsLoadingDirectory(false);
        });
    }
  }, [isAddModalOpen]);

  const handleEnroll = async () => {
    if (!selectedStudentId || !selectedCourseId) {
      toast.error("Please select both a student and a course.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Post to enrollment endpoint
      await apiClient.post(`/api/v1/courses/${selectedCourseId}/enroll`);
      toast.success("Student successfully enrolled in course!");
      queryClient.invalidateQueries({ queryKey: queryKeys.students.all() });
      setAddModalOpen(false);
      setSelectedStudentId("");
      setSelectedCourseId("");
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to enroll student.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isAddModalOpen} onOpenChange={setAddModalOpen}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
            <UserPlus className="h-5 w-5 text-primary" />
            Add / Enroll Student
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Select a student from the platform directory and assign them to one of your published courses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Select Student */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Select Student <span className="text-destructive">*</span>
            </label>
            {isLoadingDirectory ? (
              <div className="h-10 flex items-center gap-2 px-3 rounded-lg border border-border bg-background text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading students...
              </div>
            ) : (
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">-- Choose a student --</option>
                {directoryStudents.map((s: any, idx: number) => (
                  <option key={`${s.student_id || s.id}-${idx}`} value={s.student_id || s.id}>
                    {s.student_name || s.full_name || s.name} ({s.student_email || s.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Select Course */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Select Course <span className="text-destructive">*</span>
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">-- Choose a course --</option>
              {courses.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => setAddModalOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleEnroll}
            disabled={isSubmitting || !selectedStudentId || !selectedCourseId}
            className="btn-primary min-w-[140px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enrolling...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Enroll Student
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
