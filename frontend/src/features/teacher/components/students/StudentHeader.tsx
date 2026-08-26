"use client";

import * as React from "react";
import { 
  Download,
  Users,
  LayoutGrid,
  List,
  BarChart3,
  UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudentStore } from "@/stores/student.store";
import { useTeacherStudents } from "@/hooks/queries/useTeacherQueries";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function StudentHeader() {
  const { viewMode, setViewMode, setAddModalOpen } = useStudentStore();
  const { data: studentsData } = useTeacherStudents({ page: 1, pageSize: 100 });

  const handleExportCSV = () => {
    const students = studentsData?.items ?? [];
    if (students.length === 0) {
      toast.error("No student data available to export.");
      return;
    }

    const headers = ["ID", "Full Name", "Email", "Course Title", "Status", "Progress %", "Attendance %", "Joined At"];
    const rows = students.map((s) => [
      s.id,
      `"${s.fullName || ''}"`,
      `"${s.email || ''}"`,
      `"${s.courseTitle || ''}"`,
      s.status,
      s.progressPercent,
      s.attendancePercent,
      s.joinedAt,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `students_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Student directory exported to CSV!");
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-6 sm:p-8 mb-8 hover-lift card-glass">
      <div className="grid-bg absolute inset-0 opacity-40 pointer-events-none" />
      <div 
        className="glow-purple absolute pointer-events-none" 
        style={{ width: 400, height: 400, top: -100, left: "50%", transform: "translateX(-50%)", background: "radial-gradient(circle, hsl(270 80% 60% / 0.15) 0%, transparent 70%)" }} 
      />

      <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col">
          <h1 className="text-responsive-xl font-extrabold tracking-tight text-foreground drop-shadow-sm flex items-center gap-3 m-0 mb-1">
            <Users className="h-8 w-8 text-[hsl(270,80%,60%)] drop-shadow-[0_0_8px_hsla(270,80%,60%,0.5)]" />
            Student Management
          </h1>
          <p className="text-responsive-lg text-muted-foreground m-0">
            Manage enrollments, monitor progress, and engage with your students.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggles */}
          <div className="hidden md:flex items-center rounded-lg border border-border p-1 bg-card">
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center justify-center rounded-md px-2.5 py-1.5 transition-all press-scale",
                viewMode === "table" ? "bg-muted shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              title="Table View"
            >
              <List className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={() => setViewMode("card")}
              className={cn(
                "flex items-center justify-center rounded-md px-2.5 py-1.5 transition-all press-scale",
                viewMode === "card" ? "bg-muted shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              title="Card View"
            >
              <LayoutGrid className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={() => setViewMode("analytics")}
              className={cn(
                "flex items-center justify-center rounded-md px-2.5 py-1.5 transition-all press-scale",
                viewMode === "analytics" ? "bg-muted shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              title="Analytics View"
            >
              <BarChart3 className="h-[18px] w-[18px]" />
            </button>
          </div>

          <Button 
            variant="outline" 
            onClick={handleExportCSV}
            className="hidden sm:flex h-10 border-border bg-card hover:bg-muted transition-all font-semibold tracking-tight btn-ghost press-scale"
          >
            <Download className="mr-2 h-4 w-4 text-muted-foreground" />
            Export
          </Button>

          <Button 
            onClick={() => setAddModalOpen(true)}
            className="btn-primary press-scale h-10 font-bold tracking-tight shadow-[0_0_15px_hsla(270,80%,60%,0.3)] hover:shadow-[0_0_25px_hsla(270,80%,60%,0.5)] transition-all sm:ml-2 bg-[hsl(270,80%,60%)] border-none text-white"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add Student
          </Button>
        </div>
      </div>
    </div>
  );
}
