"use client";

import * as React from "react";
import { Play, MoreHorizontal, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCoursesStore } from "@/stores/courses.store";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CourseListProps {
  courses: any[];
}

export function CourseList({ courses }: CourseListProps) {
  const { setSelectedCourseId } = useCoursesStore();

  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="h-20 w-20 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <BookOpenIcon className="h-10 w-10 opacity-50" style={{ color: "#6b7280" }} />
        </div>
        <div>
          <h3 className="text-xl font-bold" style={{ color: "#fff" }}>No courses found</h3>
          <p className="max-w-sm mt-2" style={{ color: "#9ca3af" }}>Try adjusting your filters or search query to find what you're looking for.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="overflow-x-auto">
        <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <TableHead className="w-[300px]" style={{ color: "#6b7280", textTransform: "uppercase", fontSize: 11 }}>Course</TableHead>
            <TableHead style={{ color: "#6b7280", textTransform: "uppercase", fontSize: 11 }}>Teacher</TableHead>
            <TableHead style={{ color: "#6b7280", textTransform: "uppercase", fontSize: 11 }}>Category</TableHead>
            <TableHead className="w-[200px]" style={{ color: "#6b7280", textTransform: "uppercase", fontSize: 11 }}>Progress</TableHead>
            <TableHead style={{ color: "#6b7280", textTransform: "uppercase", fontSize: 11 }}>Last Activity</TableHead>
            <TableHead className="text-right" style={{ color: "#6b7280", textTransform: "uppercase", fontSize: 11 }}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {courses.map((course, idx) => (
            <TableRow 
              key={course.id ? `${course.id}-${idx}` : `student-course-list-${idx}`} 
              className="group cursor-pointer transition-colors hover:bg-white/5"
              style={{ background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)", borderBottom: "1px solid rgba(255,255,255,0.03)" }}
              onClick={() => setSelectedCourseId(course.id)}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-20 shrink-0 rounded-md overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={course.thumbnailUrl || course.thumbnail}
                      alt={course.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="h-5 w-5 fill-white text-white" />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold line-clamp-1 transition-colors" style={{ color: "#e5e7eb" }}>{course.title}</span>
                    <span className="text-xs" style={{ color: "#6b7280" }}>{course.totalModules} Modules</span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="font-medium" style={{ color: "#e5e7eb" }}>{course.teacher}</TableCell>
              <TableCell>
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                  {course.category}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div 
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${course.progress}%`, background: course.progress === 100 ? "#10b981" : "#4f46e5" }}
                      />
                    </div>
                  </div>
                  <span className={`text-xs font-bold w-10 text-right ${course.progress === 100 ? 'text-emerald-500' : ''}`} style={{ color: course.progress === 100 ? undefined : "#e5e7eb" }}>
                    {course.progress}%
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-sm" style={{ color: "#9ca3af" }}>{course.lastWatched}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-white/5 transition-colors" style={{ color: "#9ca3af" }} onClick={(e) => { e.stopPropagation(); }}>
                    <Bookmark className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-white/5 transition-colors" style={{ color: "#9ca3af" }} onClick={(e) => { e.stopPropagation(); }}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}

function BookOpenIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}
