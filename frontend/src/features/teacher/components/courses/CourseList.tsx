"use client";

import * as React from "react";
import { format } from "date-fns";
import { MoreHorizontal, FileEdit, Trash2, Archive, BarChart, Loader2 } from "lucide-react";
import { useTeacherCourses, useDeleteCourse, useUpdateCourse } from "@/hooks/queries/useTeacherQueries";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";

export function CourseList({ search, status }: { search?: string; status?: string }) {
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set());
  const { data, isLoading, isError, error } = useTeacherCourses({ page: 1, pageSize: 100 }, { ...(search ? { search } : {}), ...(status ? { status } : {}) });
  const courses = data?.items ?? [];
  const deleteMutation = useDeleteCourse();
  const updateMutation = useUpdateCourse();

  const toggleAll = () => {
    if (selectedRows.size === courses.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(courses.map(c => c.id)));
    }
  };

  const toggleRow = (id: string) => {
    const next = new Set(selectedRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRows(next);
  };

  const handleBulkArchive = () => {
    selectedRows.forEach((id) => updateMutation.mutate({ id, status: "ARCHIVED" }));
    toast.success(`${selectedRows.size} courses archived.`);
    setSelectedRows(new Set());
  };

  const handleBulkDelete = () => {
    selectedRows.forEach((id) => deleteMutation.mutate(id));
    toast.success(`${selectedRows.size} courses deleted.`);
    setSelectedRows(new Set());
  };

  const handleDeleteCourse = (course: any) => {
    deleteMutation.mutate(course.id, {
      onSuccess: () => {
        toast.success(`Course "${course.title}" was deleted.`);
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to delete course.");
      },
    });
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '96px 0', borderRadius: '18px', background: 'hsl(var(--border))', border: '1px solid hsl(var(--border))' }}>
        <Loader2 style={{ height: '32px', width: '32px', animation: 'spin 1s linear infinite', color: 'hsl(var(--border))' }} />
      </div>
    );
  }

  if (isError) {
    const msg = (error as any)?.message ?? "Failed to load courses. Make sure the backend is running.";
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '96px 24px', borderRadius: '18px', border: '1px solid rgba(239,68,68,0.2)', textAlign: 'center' }}>
        <p style={{ fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 6 }}>Could not load courses</p>
        <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', maxWidth: 360 }}>{msg}</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', overflow: 'hidden', borderRadius: '18px', background: 'hsl(var(--border))', border: '1px solid hsl(var(--border))', transition: 'all 0.2s' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead
            style={{
              color: '#6b7280',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              background: 'hsl(var(--border))',
              borderBottom: '1px solid hsl(var(--border))'
            }}
          >
            <tr>
              <th scope="col" style={{ padding: '16px 24px', width: '60px' }}>
                <input 
                  type="checkbox"
                  checked={selectedRows.size === courses.length && courses.length > 0}
                  onChange={toggleAll}
                  aria-label="Select all"
                  style={{
                    height: '16px',
                    width: '16px',
                    borderRadius: '4px',
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--border))',
                    accentColor: "hsl(var(--primary))",
                    cursor: 'pointer'
                  }}
                />
              </th>
              <th scope="col" style={{ padding: '16px 24px' }}>Course</th>
              <th scope="col" style={{ padding: '16px 24px' }}>Status</th>
              <th scope="col" style={{ padding: '16px 24px' }}>Students</th>
              <th scope="col" style={{ padding: '16px 24px' }}>Price</th>
              <th scope="col" style={{ padding: '16px 24px' }} className="hidden md:table-cell">Updated</th>
              <th scope="col" style={{ padding: '16px 24px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody style={{ background: 'transparent' }}>
            {courses.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '64px 24px', textAlign: 'center', color: "hsl(var(--muted-foreground))", fontWeight: 500 }}>
                  No courses found. Create your first course to get started.
                </td>
              </tr>
            ) : (
              courses.map((course, idx) => {
                const isSelected = selectedRows.has(course.id);
                const isDraft = course.status === "DRAFT";
                const isArchived = course.status === "ARCHIVED";
                
                return (
                  <tr 
                    key={course.id ? `${course.id}-${idx}` : `teacher-course-list-${idx}`} 
                    style={{
                      borderBottom: '1px solid hsl(var(--border))',
                      background: isSelected ? 'rgba(124, 58, 237, 0.05)' : 'transparent',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'hsl(var(--border))';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td style={{ padding: '16px 24px' }}>
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(course.id)}
                        aria-label={`Select ${course.title}`}
                        style={{
                          height: '16px',
                          width: '16px',
                          borderRadius: '4px',
                          border: '1px solid hsl(var(--border))',
                          background: 'hsl(var(--border))',
                          accentColor: "hsl(var(--primary))",
                          cursor: 'pointer'
                        }}
                      />
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ position: 'relative', height: '48px', width: '80px', flexShrink: 0, overflow: 'hidden', borderRadius: '8px', background: 'hsl(var(--border))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid hsl(var(--border))' }} className="hidden sm:flex">
                          {course.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={course.thumbnailUrl}
                              alt={course.title}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                            />
                          ) : (
                            <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'hsl(var(--border))' }}>{course.title[0]}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <Link href={`/teacher/courses/${course.id}`} style={{ textDecoration: 'none' }}>
                            <span style={{ fontWeight: 800, color: "hsl(var(--foreground))", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }} className="hover:text-primary transition-colors">
                              {course.title}
                            </span>
                          </Link>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: "hsl(var(--muted-foreground))", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {course.totalLectures} lectures • {course.currency === "USD" ? "$" : course.currency}{course.price}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <Badge
                        variant={isDraft ? "outline" : "default"}
                        style={{
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                          fontSize: '9px',
                          textTransform: 'uppercase',
                          padding: '4px 8px',
                          borderRadius: '8px',
                          border: isDraft ? '1px solid rgba(245,158,11,0.2)' : isArchived ? '1px solid hsl(var(--border))' : '1px solid rgba(16,185,129,0.2)',
                          background: isDraft ? 'rgba(245,158,11,0.1)' : isArchived ? 'hsl(var(--border))' : 'rgba(16,185,129,0.1)',
                          color: isDraft ? '#f59e0b' : isArchived ? "hsl(var(--muted-foreground))" : '#10b981',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {course.status}
                      </Badge>
                    </td>
                    <td style={{ padding: '16px 24px', fontWeight: 800, color: "hsl(var(--foreground))" }}>
                      {(course.enrolledCount ?? (course as any).total_enrollments ?? 0).toLocaleString()} / {(course.maxStudents ?? (course as any).max_students ?? 50).toLocaleString()}
                    </td>
                    <td style={{ padding: '16px 24px', fontWeight: 800, color: "hsl(var(--foreground))" }}>
                      {course.price === 0 ? "Free" : `₹${course.price.toLocaleString("en-IN")}`}
                    </td>
                    <td style={{ padding: '16px 24px', color: "hsl(var(--muted-foreground))", fontSize: '0.75rem', fontWeight: 600 }} className="hidden md:table-cell">
                      {course.updatedAt ? format(new Date(course.updatedAt), "MMM d, yyyy") : "—"}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            style={{
                              height: '32px',
                              width: '32px',
                              padding: 0,
                              background: 'transparent',
                              border: 'none',
                              color: "hsl(var(--muted-foreground))",
                              borderRadius: '8px',
                              cursor: 'pointer'
                            }}
                          >
                            <MoreHorizontal style={{ height: '16px', width: '16px' }} />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" style={{ background: "hsl(var(--background))", border: '1px solid hsl(var(--border))', color: "hsl(var(--foreground))", borderRadius: '10px' }}>
                          <DropdownMenuItem style={{ fontWeight: 500, cursor: 'pointer' }} asChild>
                            <Link href={`/teacher/courses/${course.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}>
                              <BarChart style={{ marginRight: '8px', height: '16px', width: '16px', color: "hsl(var(--primary))" }} />
                              View Course Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem style={{ fontWeight: 500, cursor: 'pointer' }} asChild>
                            <Link href={`/teacher/builder?courseId=${course.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}>
                              <FileEdit style={{ marginRight: '8px', height: '16px', width: '16px', color: "hsl(var(--muted-foreground))" }} />
                              Edit Course
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem style={{ fontWeight: 500, cursor: 'pointer' }}>
                            <BarChart style={{ marginRight: '8px', height: '16px', width: '16px', color: "hsl(var(--muted-foreground))" }} />
                            Analytics
                          </DropdownMenuItem>
                          <DropdownMenuSeparator style={{ background: 'hsl(var(--border))' }} />
                          {!isArchived && (
                            <DropdownMenuItem style={{ fontWeight: 500, color: '#ef4444', cursor: 'pointer' }} onClick={() => updateMutation.mutate({ id: course.id, status: "ARCHIVED" })}>
                              <Archive style={{ marginRight: '8px', height: '16px', width: '16px' }} />
                              Archive
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem style={{ fontWeight: 500, color: '#ef4444', cursor: 'pointer' }} onClick={() => handleDeleteCourse(course)}>
                            <Trash2 style={{ marginRight: '8px', height: '16px', width: '16px' }} />
                            Delete Course
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      
      {/* Table Footer - Bulk Actions Context */}
      {selectedRows.size > 0 && (
        <div style={{ background: 'rgba(124, 58, 237, 0.1)', borderTop: '1px solid rgba(124, 58, 237, 0.2)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 800, color: "hsl(var(--primary))", display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ height: '8px', width: '8px', borderRadius: '50%', background: "hsl(var(--primary))" }} />
            {selectedRows.size} course{selectedRows.size > 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Button
              variant="outline"
              size="sm"
              style={{
                background: 'hsl(var(--border))',
                border: '1px solid hsl(var(--border))',
                color: "hsl(var(--foreground))",
                fontWeight: 600,
                borderRadius: '8px',
                cursor: 'pointer'
              }}
              onClick={handleBulkArchive}
            >
              Archive Selected
            </Button>
            <Button
              variant="destructive"
              size="sm"
              style={{
                background: '#ef4444',
                color: "hsl(var(--foreground))",
                border: 'none',
                fontWeight: 600,
                borderRadius: '8px',
                cursor: 'pointer'
              }}
              onClick={handleBulkDelete}
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
