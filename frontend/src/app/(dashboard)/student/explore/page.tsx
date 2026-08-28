"use client";

import * as React from "react";
import Link from "next/link";
import {
  Compass,
  BookOpen,
  Users,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Loader2,
  GraduationCap,
} from "lucide-react";
import { courseService } from "@/services/course.service";
import { Course } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

const THUMBNAIL_FALLBACKS = [
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='225' viewBox='0 0 400 225'><defs><linearGradient id='g1' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%231e1b4b'/><stop offset='100%' stop-color='%234338ca'/></linearGradient></defs><rect width='400' height='225' fill='url(%23g1)'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='225' viewBox='0 0 400 225'><defs><linearGradient id='g2' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%23064e3b'/><stop offset='100%' stop-color='%23059669'/></linearGradient></defs><rect width='400' height='225' fill='url(%23g2)'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='225' viewBox='0 0 400 225'><defs><linearGradient id='g3' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%23581c87'/><stop offset='100%' stop-color='%237e22ce'/></linearGradient></defs><rect width='400' height='225' fill='url(%23g3)'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='225' viewBox='0 0 400 225'><defs><linearGradient id='g4' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%231e293b'/><stop offset='100%' stop-color='%23334155'/></linearGradient></defs><rect width='400' height='225' fill='url(%23g4)'/></svg>",
];

type ExploreCourse = Course & {
  isEnrolled?: boolean;
};

export default function ExploreCoursesPage() {
  const [courses, setCourses] = React.useState<ExploreCourse[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [enrollingId, setEnrollingId] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const fetchExploreCourses = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await courseService.explore({ page: 1, pageSize: 50 });
      setCourses(res.items);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch explore courses:", err);
      setError("Failed to load catalog courses. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchExploreCourses();
  }, [fetchExploreCourses]);

  const handleEnroll = async (courseId: string, courseTitle: string) => {
    setEnrollingId(courseId);
    setSuccessMessage(null);
    try {
      await courseService.enroll(courseId);
      setCourses((prev) =>
        prev.map((c) =>
          c.id === courseId
            ? {
                ...c,
                isEnrolled: true,
                enrolledCount: (c.enrolledCount ?? 0) + 1,
              }
            : c
        )
      );
      setSuccessMessage(`Successfully enrolled in "${courseTitle}"!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error("Enrollment failed:", err);
      alert(err?.response?.data?.message || "Failed to enroll. Please try again.");
    } finally {
      setEnrollingId(null);
    }
  };

  const filteredCourses = courses;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      {/* Header Banner */}
      <div
        className="relative overflow-hidden rounded-3xl p-8 lg:p-10 border"
        style={{
          background:
            "linear-gradient(135deg, rgba(30,27,75,0.7) 0%, rgba(67,56,202,0.4) 50%, rgba(15,23,42,0.8) 100%)",
          borderColor: "rgba(99,102,241,0.2)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="relative z-10 max-w-3xl space-y-4">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-semibold"
            style={{
              background: "rgba(99,102,241,0.15)",
              color: "#a5b4fc",
              border: "1px solid rgba(99,102,241,0.3)",
            }}
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Course Catalog</span>
          </div>

          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
            Explore & Enroll in Courses
          </h1>
          <p className="text-base text-slate-300 leading-relaxed">
            Browse through all available live and recorded speaking courses. Select any course to instantly enroll and start practicing with expert teachers and peers.
          </p>
        </div>

        {/* Floating background graphic */}
        <div
          className="absolute -right-10 -bottom-10 h-72 w-72 rounded-full blur-3xl pointer-events-none"
          style={{ background: "rgba(99,102,241,0.25)" }}
        />
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div
          className="flex items-center gap-3 p-4 rounded-2xl animate-in slide-in-from-top duration-300"
          style={{
            background: "rgba(16,185,129,0.15)",
            border: "1px solid rgba(16,185,129,0.3)",
            color: "#34d399",
          }}
        >
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-semibold">{successMessage}</span>
          <Link
            href="/student/courses"
            className="ml-auto flex items-center gap-1 text-xs font-bold underline"
            style={{ color: "#6ee7b7" }}
          >
            Go to My Courses <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Course Grid */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-indigo-400" />
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Available Courses ({filteredCourses.length})
            </h2>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton
                key={i}
                className="h-72 w-full rounded-2xl"
                style={{ background: "rgba(255,255,255,0.04)" }}
              />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-20" style={{ color: "#ef4444" }}>
            {error}
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="text-center py-16 rounded-3xl border border-dashed border-white/10 p-8">
            <Compass className="h-12 w-12 text-slate-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground">No Courses Found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              No published courses available right now.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCourses.map((course, idx) => {
              const isEnrolled = course.isEnrolled;
              const isEnrollingThis = enrollingId === course.id;

              return (
                <div
                  key={course.id ? `${course.id}-${idx}` : `explore-course-${idx}`}
                  className="group relative flex flex-col rounded-3xl border transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                  style={{
                    background: "hsl(var(--card))",
                    borderColor: isEnrolled
                      ? "rgba(16,185,129,0.3)"
                      : "hsl(var(--border))",
                    boxShadow: isEnrolled
                      ? "0 0 25px rgba(16,185,129,0.08)"
                      : "0 10px 30px rgba(0,0,0,0.2)",
                  }}
                >
                  {/* Thumbnail / Header */}
                  <Link href={`/student/courses/${course.id}`} className="relative h-44 w-full overflow-hidden bg-slate-950 block">
                    <img
                      src={
                        course.thumbnailUrl ||
                        THUMBNAIL_FALLBACKS[idx % THUMBNAIL_FALLBACKS.length]
                      }
                      alt={course.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />

                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                      {isEnrolled ? (
                        <span
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold"
                          style={{
                            background: "rgba(16,185,129,0.9)",
                            color: "#022c22",
                            boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
                          }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Enrolled
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                          style={{
                            background: "rgba(99,102,241,0.85)",
                            color: "#ffffff",
                            boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
                          }}
                        >
                          <Sparkles className="h-3 w-3" /> Available
                        </span>
                      )}
                    </div>
                  </Link>

                  {/* Body Content */}
                  <div className="flex flex-1 flex-col p-5 space-y-4">
                    <div>
                      <Link href={`/student/courses/${course.id}`}>
                        <h3 className="font-bold text-base text-foreground line-clamp-1 group-hover:text-indigo-400 transition-colors">
                          {course.title}
                        </h3>
                      </Link>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {course.description || "Master communication skills with interactive live sessions and personalized guidance."}
                      </p>
                    </div>

                    <div className="mt-auto space-y-3 pt-2">
                      {/* Course Metadata */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5 font-medium">
                          <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
                          <span>{course.totalLectures ?? 0} Lectures</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-medium">
                          <Users className="h-3.5 w-3.5 text-violet-400" />
                          <span>
                            {(course.enrolledCount ?? 0).toLocaleString()} /{" "}
                            {(course.maxStudents ?? 50).toLocaleString()} seats
                          </span>
                        </div>
                      </div>

                      {/* Price & Action Button */}
                      <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                        <div>
                          <span className="text-xs text-muted-foreground block">Price</span>
                          <span className="text-sm font-extrabold text-foreground">
                            {course.price === 0 ? "Free" : `₹${course.price.toLocaleString("en-IN")}`}
                          </span>
                        </div>

                        {isEnrolled ? (
                          <Link
                            href={`/student/courses/${course.id}`}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                            style={{
                              background: "rgba(16,185,129,0.15)",
                              color: "#34d399",
                              border: "1px solid rgba(16,185,129,0.3)",
                            }}
                          >
                            Go to Course <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        ) : (course.enrolledCount ?? 0) >= (course.maxStudents ?? 50) ? (
                          <button
                            disabled
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-not-allowed opacity-75"
                            style={{
                              background: "rgba(239, 68, 68, 0.12)",
                              color: "#f87171",
                              border: "1px solid rgba(239, 68, 68, 0.25)",
                            }}
                          >
                            Course Full
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEnroll(course.id, course.title)}
                            disabled={isEnrollingThis}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-95 disabled:opacity-50"
                            style={{
                              background:
                                "linear-gradient(135deg, hsl(var(--primary)), #6366f1)",
                              color: "#ffffff",
                            }}
                          >
                            {isEnrollingThis ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enrolling...
                              </>
                            ) : (
                              <>
                                Enroll Now <ArrowRight className="h-3.5 w-3.5" />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
