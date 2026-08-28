"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  FileEdit,
  Play,
  FileText,
  Clock,
  User,
  Users,
  MessageSquare,
  BookOpen,
  Sparkles,
  Download,
  Video,
  ChevronRight,
  TrendingUp,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  Archive,
  Trash2,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/services/api/client";
import { format } from "date-fns";
import { getCourseThumbnailUrl } from "@/lib/utils";

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  level?: string;
  category?: string;
  status?: string;
  is_published?: boolean;
  price?: number;
  max_students?: number;
  maxStudents?: number;
  total_enrollments?: number;
  enrolled_count?: number;
  completion_rate?: number;
  thumbnail_r2_key?: string;
  thumbnail_url?: string;
  created_at?: string;
  updated_at?: string;
}

interface VideoItem {
  id: string;
  title: string;
  duration_seconds?: number;
  durationSeconds?: number;
  description?: string;
  order_index?: number;
  r2_object_key?: string;
}

interface PdfItem {
  id: string;
  title: string;
  file_size_bytes?: number;
  description?: string;
  r2_object_key?: string;
}

interface StudentItem {
  student_id: string;
  student_name: string;
  student_email: string;
  progress_percent?: number;
  enrolled_at?: string;
}

export default function TeacherCourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.courseId as string;

  const [course, setCourse] = React.useState<CourseDetail | null>(null);
  const [videos, setVideos] = React.useState<VideoItem[]>([]);
  const [pdfs, setPdfs] = React.useState<PdfItem[]>([]);
  const [students, setStudents] = React.useState<StudentItem[]>([]);
  const [activeTab, setActiveTab] = React.useState<"videos" | "students" | "pdfs" | "about">("videos");
  const [activeVideo, setActiveVideo] = React.useState<VideoItem | null>(null);

  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!courseId) return;

    setIsLoading(true);
    setError(null);

    Promise.all([
      apiClient.get(`/api/v1/teacher/courses/${courseId}`).catch(() => null),
      apiClient.get(`/api/v1/teacher/courses/${courseId}/videos`).catch(() => null),
      apiClient.get(`/api/v1/teacher/courses/${courseId}/pdfs`).catch(() => null),
      apiClient.get(`/api/v1/teacher/students`, { params: { course_id: courseId } }).catch(() => null),
    ])
      .then(([courseRes, videosRes, pdfsRes, studentsRes]) => {
        const courseData = courseRes?.data?.data ?? courseRes?.data;
        if (courseData) {
          setCourse(courseData);
        } else {
          setError("Course details not found.");
        }

        const videoList = videosRes?.data?.data ?? videosRes?.data ?? [];
        if (Array.isArray(videoList)) {
          setVideos(videoList);
          if (videoList.length > 0) {
            setActiveVideo(videoList[0]);
          }
        }

        const pdfList = pdfsRes?.data?.data ?? pdfsRes?.data ?? [];
        if (Array.isArray(pdfList)) {
          setPdfs(pdfList);
        }

        const rawStudents = studentsRes?.data?.items ?? studentsRes?.data?.data ?? studentsRes?.data ?? [];
        if (Array.isArray(rawStudents)) {
          setStudents(rawStudents);
        }
      })
      .catch((err) => {
        console.error("Failed to load course detail:", err);
        setError("Failed to load course details. Please try again.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [courseId]);

  if (isLoading) {
    return (
      <div className="space-y-8 pb-20 animate-in fade-in duration-500 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-24 rounded-lg bg-card/60" />
          <Skeleton className="h-6 w-48 rounded-lg bg-card/60" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl bg-card/60" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-96 rounded-2xl bg-card/60" />
          <Skeleton className="h-96 rounded-2xl bg-card/60" />
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 max-w-7xl mx-auto p-4">
        <div className="h-16 w-16 rounded-full flex items-center justify-center bg-card border border-border">
          <BookOpen className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-xl font-bold text-foreground">{error || "Course Not Found"}</h3>
        <Button variant="outline" onClick={() => router.push("/teacher/courses")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Courses
        </Button>
      </div>
    );
  }

  const thumbnailUrl = getCourseThumbnailUrl(course);
  const status = course.status || (course.is_published ? "PUBLISHED" : "DRAFT");
  const enrolledCount = course.enrolled_count ?? course.total_enrollments ?? students.length;
  const maxStudents = course.maxStudents ?? course.max_students ?? 50;
  const price = course.price ?? 0;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/teacher/courses")}
          className="text-muted-foreground hover:text-foreground hover:bg-card transition-all -ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Courses
        </Button>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/teacher/communication?courseId=${courseId}`)}
            className="text-xs font-bold btn-outline gap-2"
          >
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
            Class Announcement / Chat
          </Button>

          <Button
            size="sm"
            onClick={() => router.push(`/teacher/builder?courseId=${courseId}`)}
            className="text-xs font-bold btn-primary gap-2"
          >
            <FileEdit className="h-3.5 w-3.5" />
            Edit Course
          </Button>
        </div>
      </div>

      {/* ── HERO BANNER ─────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl border border-border p-6 sm:p-8 card-glass shadow-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,27,75,0.85) 100%)",
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={status === "DRAFT" ? "outline" : "default"}
                className={`font-bold tracking-widest text-[9px] uppercase px-2 py-0.5 ${
                  status === "DRAFT"
                    ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                    : status === "ARCHIVED"
                    ? "bg-secondary text-muted-foreground border-border"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                }`}
              >
                {status}
              </Badge>

              <span className="px-3 py-0.5 rounded-full text-xs font-medium bg-card text-muted-foreground border border-border">
                {course.level || "All Levels"}
              </span>

              <span className="px-3 py-0.5 rounded-full text-xs font-medium bg-card text-muted-foreground border border-border">
                {course.category || "General"}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
              {course.title}
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed line-clamp-3">
              {course.description || "Comprehensive course content and curriculum created for your enrolled students."}
            </p>

            {/* Quick Stats Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/10">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Price</span>
                <span className="text-base font-extrabold text-foreground">
                  {price === 0 ? "Free" : `₹${price.toLocaleString("en-IN")}`}
                </span>
              </div>

              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Students</span>
                <span className="text-base font-extrabold text-foreground">
                  {enrolledCount} / {maxStudents}
                </span>
              </div>

              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Lectures</span>
                <span className="text-base font-extrabold text-foreground">
                  {videos.length} Video{videos.length === 1 ? "" : "s"}
                </span>
              </div>

              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">PDF Guides</span>
                <span className="text-base font-extrabold text-foreground">
                  {pdfs.length} Document{pdfs.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>

          {/* Thumbnail / Action Box */}
          <div className="flex flex-col gap-4">
            <div className="relative aspect-video rounded-xl overflow-hidden border border-white/15 shadow-2xl group bg-black/40">
              <Image
                src={thumbnailUrl}
                alt={course.title}
                fill
                className="object-cover"
                unoptimized
              />
            </div>

            <Button
              onClick={() => router.push(`/teacher/builder?courseId=${courseId}`)}
              className="w-full h-11 text-sm font-bold btn-primary shadow-lg"
              style={{ borderRadius: 10 }}
            >
              <FileEdit className="mr-2 h-4 w-4" />
              Edit Course & Modules
            </Button>
          </div>
        </div>
      </div>

      {/* ── DETAILS & TABS SECTION ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Navigation Tabs */}
          <div className="flex border-b border-border gap-6">
            <button
              className={`pb-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === "videos"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("videos")}
            >
              Curriculum Videos ({videos.length})
            </button>

            <button
              className={`pb-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === "students"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("students")}
            >
              Enrolled Students ({students.length})
            </button>

            <button
              className={`pb-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === "pdfs"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("pdfs")}
            >
              Resource Documents ({pdfs.length})
            </button>

            <button
              className={`pb-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === "about"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("about")}
            >
              Course Overview
            </button>
          </div>

          {/* TAB 1: CURRICULUM VIDEOS */}
          {activeTab === "videos" && (
            <div className="space-y-4">
              {activeVideo && (
                <div className="rounded-2xl border border-border overflow-hidden bg-black shadow-2xl space-y-3 p-4">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <Play className="h-3.5 w-3.5 fill-current" /> Lecture Preview
                    </span>
                    <span className="text-xs text-muted-foreground">{activeVideo.title}</span>
                  </div>
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center">
                    {activeVideo.r2_object_key ? (
                      <video
                        src={activeVideo.r2_object_key}
                        controls
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center p-6 space-y-2">
                        <Video className="h-12 w-12 text-muted-foreground mx-auto opacity-50" />
                        <p className="text-sm font-medium text-foreground">{activeVideo.title}</p>
                        <p className="text-xs text-muted-foreground">Video ready for student viewing.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {videos.length === 0 ? (
                  <div className="p-8 text-center rounded-xl border border-dashed border-border bg-card">
                    <p className="text-sm text-muted-foreground mb-3">No video lectures uploaded for this course yet.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/teacher/builder?courseId=${courseId}`)}
                    >
                      <FileEdit className="mr-2 h-4 w-4" /> Add Videos in Builder
                    </Button>
                  </div>
                ) : (
                  videos.map((vid, idx) => {
                    const isCurrent = activeVideo?.id === vid.id;
                    return (
                      <div
                        key={vid.id || idx}
                        onClick={() => setActiveVideo(vid)}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                          isCurrent
                            ? "bg-primary/10 border-primary/40 text-foreground"
                            : "bg-card border-border hover:border-primary/30 hover:bg-card/80"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isCurrent ? "bg-primary text-white" : "bg-primary/10 text-primary"
                          }`}>
                            <Play className="h-4 w-4 fill-current ml-0.5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold truncate text-foreground">{idx + 1}. {vid.title}</h4>
                            <p className="text-xs text-muted-foreground truncate">
                              {vid.description || "Course Video Lecture"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                          {vid.duration_seconds ? (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" /> {Math.ceil(vid.duration_seconds / 60)} min
                            </span>
                          ) : null}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ENROLLED STUDENTS */}
          {activeTab === "students" && (
            <div className="space-y-4">
              {students.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-border bg-card">
                  <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-foreground">No students enrolled yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Students who enroll in this course will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {students.map((st, idx) => (
                    <div
                      key={st.student_id || idx}
                      className="p-4 rounded-xl border border-border bg-card flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                          {st.student_name?.[0] || "S"}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-foreground truncate">{st.student_name}</h4>
                          <p className="text-xs text-muted-foreground truncate">{st.student_email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 shrink-0 text-xs">
                        <div className="text-right">
                          <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Progress</span>
                          <span className="font-extrabold text-foreground">{st.progress_percent ?? 0}%</span>
                        </div>
                        {st.enrolled_at && (
                          <div className="text-right hidden sm:block">
                            <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Enrolled</span>
                            <span className="font-medium text-muted-foreground">{format(new Date(st.enrolled_at), "MMM d, yyyy")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PDF GUIDES */}
          {activeTab === "pdfs" && (
            <div className="space-y-4">
              {pdfs.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-border bg-card">
                  <p className="text-sm text-muted-foreground mb-3">No PDF resource guides uploaded for this course yet.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/teacher/builder?courseId=${courseId}`)}
                  >
                    <FileEdit className="mr-2 h-4 w-4" /> Add PDFs in Builder
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {pdfs.map((pdf, idx) => (
                    <div key={pdf.id || idx} className="p-4 rounded-xl border border-border bg-card flex flex-col justify-between space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold truncate text-foreground">{pdf.title}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2">{pdf.description || "PDF Document"}</p>
                        </div>
                      </div>

                      {pdf.r2_object_key && (
                        <a
                          href={pdf.r2_object_key}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full"
                        >
                          <Button variant="outline" size="sm" className="w-full text-xs btn-outline gap-1.5">
                            <Download className="h-3.5 w-3.5" /> Download Resource
                          </Button>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ABOUT */}
          {activeTab === "about" && (
            <div className="space-y-4 p-6 rounded-2xl border border-border bg-card">
              <h3 className="text-lg font-bold text-foreground">Course Description</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {course.description || "No full description provided for this course yet."}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Management Actions
            </h3>

            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start text-xs h-10 btn-outline"
                onClick={() => router.push(`/teacher/builder?courseId=${courseId}`)}
              >
                <FileEdit className="mr-2 h-4 w-4 text-primary" />
                Edit Course Content
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-xs h-10 btn-outline"
                onClick={() => router.push(`/teacher/communication?courseId=${courseId}`)}
              >
                <MessageSquare className="mr-2 h-4 w-4 text-indigo-400" />
                Course Announcement & Chat
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-xs h-10 btn-outline"
                onClick={() => router.push(`/teacher/students?courseId=${courseId}`)}
              >
                <Users className="mr-2 h-4 w-4 text-emerald-400" />
                Manage Course Students
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
