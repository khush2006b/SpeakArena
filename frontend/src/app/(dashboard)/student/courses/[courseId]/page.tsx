"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  FileText,
  Clock,
  CheckCircle2,
  Lock,
  User,
  MessageSquare,
  BookOpen,
  Award,
  Sparkles,
  Download,
  Video,
  ChevronRight,
  Megaphone,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/services/api/client";
import { formatDistanceToNow } from "date-fns";

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  level?: string;
  category?: string;
  thumbnail_r2_key?: string;
  teacher_name?: string;
  teacherName?: string;
  is_published?: boolean;
  total_lectures?: number;
  total_duration_minutes?: number;
  created_at?: string;
}

interface VideoItem {
  id: string;
  title: string;
  duration_seconds?: number;
  durationSeconds?: number;
  description?: string;
  order_index?: number;
  r2_object_key?: string;
  r2_hls_playlist_key?: string;
}

interface PdfItem {
  id: string;
  title: string;
  file_size_bytes?: number;
  description?: string;
  r2_object_key?: string;
}

const THUMBNAIL_FALLBACK =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='675' viewBox='0 0 1200 675'><defs><linearGradient id='g1' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%231e1b4b'/><stop offset='50%' stop-color='%234338ca'/><stop offset='100%' stop-color='%237e22ce'/></linearGradient></defs><rect width='1200' height='675' fill='url(%23g1)'/></svg>";

export default function StudentCourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.courseId as string;

  const [course, setCourse] = React.useState<CourseDetail | null>(null);
  const [videos, setVideos] = React.useState<VideoItem[]>([]);
  const [pdfs, setPdfs] = React.useState<PdfItem[]>([]);
  const [activeTab, setActiveTab] = React.useState<"content" | "pdfs" | "about">("content");
  const [activeVideo, setActiveVideo] = React.useState<VideoItem | null>(null);

  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!courseId) return;

    setIsLoading(true);
    setError(null);

    // Fetch course details, videos, and pdfs
    Promise.all([
      apiClient.get(`/api/v1/teacher/courses/${courseId}`).catch(() => null),
      apiClient.get(`/api/v1/teacher/courses/${courseId}/videos`).catch(() => null),
      apiClient.get(`/api/v1/teacher/courses/${courseId}/pdfs`).catch(() => null),
    ])
      .then(([courseRes, videosRes, pdfsRes]) => {
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
      })
      .catch((err) => {
        console.error("Failed to load course detail:", err);
        setError("Failed to load course details. Please try again.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [courseId]);

  const teacherName = course?.teacher_name || course?.teacherName || "Paras (Construction)";

  if (isLoading) {
    return (
      <div className="space-y-8 pb-20 animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-24 rounded-lg" style={{ background: "rgba(255,255,255,0.06)" }} />
          <Skeleton className="h-6 w-48 rounded-lg" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-96 rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />
          <Skeleton className="h-96 rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="h-16 w-16 rounded-full flex items-center justify-center bg-card border border-border">
          <BookOpen className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-xl font-bold text-foreground">{error || "Course Not Found"}</h3>
        <Button variant="outline" onClick={() => router.push("/student/courses")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Courses
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      {/* ── TOP NAV BAR ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/student/courses")}
          className="text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all -ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Courses
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/student/messages?courseId=${courseId}`)}
            className="text-xs font-semibold btn-outline gap-1.5"
          >
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
            Class Chat
          </Button>
        </div>
      </div>

      {/* ── COURSE HERO BANNER ─────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 p-6 sm:p-8 card-glass"
        style={{
          background: "linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,27,75,0.85) 100%)",
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">
                {course.level || "All Levels"}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-muted-foreground border border-white/10">
                {course.category || "General"}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
              {course.title}
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed line-clamp-3">
              {course.description || "Master new skills with comprehensive video lectures, downloadable guides, and teacher support."}
            </p>

            <div className="flex flex-wrap items-center gap-6 pt-2 text-xs sm:text-sm text-muted-foreground font-medium">
              <div className="flex items-center gap-2 text-foreground">
                <User className="h-4 w-4 text-primary" />
                <span>Instructor: <strong>{teacherName}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Video className="h-4 w-4 text-indigo-400" />
                <span>{videos.length} Video Lecture{videos.length === 1 ? "" : "s"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-amber-400" />
                <span>{pdfs.length} PDF Guide{pdfs.length === 1 ? "" : "s"}</span>
              </div>
            </div>
          </div>

          {/* Thumbnail / Action Box */}
          <div className="flex flex-col gap-4">
            <div className="relative aspect-video rounded-xl overflow-hidden border border-white/15 shadow-2xl group cursor-pointer bg-black/40">
              <Image
                src={course.thumbnail_r2_key || THUMBNAIL_FALLBACK}
                alt={course.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                unoptimized
              />
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <div className="h-14 w-14 rounded-full bg-primary/90 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                  <Play className="h-6 w-6 fill-current ml-1" />
                </div>
              </div>
            </div>

            <Button
              className="w-full h-12 text-base font-bold btn-primary shadow-lg"
              style={{ borderRadius: 12 }}
              onClick={() => {
                if (videos.length > 0) {
                  setActiveVideo(videos[0]);
                }
              }}
            >
              <Play className="mr-2 h-5 w-5 fill-current" />
              Start Learning Now
            </Button>
          </div>
        </div>
      </div>

      {/* ── COURSE CONTENT & LESSONS SECTION ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Navigation Tabs */}
          <div className="flex border-b border-border gap-6">
            <button
              className={`pb-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === "content"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("content")}
            >
              Video Lectures ({videos.length})
            </button>
            <button
              className={`pb-3 text-sm font-bold border-b-2 transition-all ${
                activeTab === "pdfs"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("pdfs")}
            >
              Resource Guides ({pdfs.length})
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

          {/* Active Player View (if video selected) */}
          {activeVideo && activeTab === "content" && (
            <div className="rounded-2xl border border-white/10 overflow-hidden bg-black shadow-2xl space-y-3 p-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Play className="h-3.5 w-3.5 fill-current" /> Now Playing
                </span>
                <span className="text-xs text-muted-foreground">{activeVideo.title}</span>
              </div>
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center">
                {activeVideo.r2_object_key ? (
                  <video
                    src={activeVideo.r2_object_key}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-6 space-y-2">
                    <Video className="h-12 w-12 text-muted-foreground mx-auto opacity-50" />
                    <p className="text-sm font-medium text-foreground">{activeVideo.title}</p>
                    <p className="text-xs text-muted-foreground">Video stream ready for playback.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 1: VIDEO LECTURES */}
          {activeTab === "content" && (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" /> Lectures Curriculum
              </h3>

              {videos.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-border bg-card">
                  <p className="text-sm text-muted-foreground">No video lectures uploaded yet for this course.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {videos.map((vid, idx) => {
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
                              {vid.description || "Click to watch lecture"}
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
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RESOURCE PDFS */}
          {activeTab === "pdfs" && (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-400" /> Study Guides & Resource Documents
              </h3>

              {pdfs.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-border bg-card">
                  <p className="text-sm text-muted-foreground">No PDF guides uploaded yet for this course.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {pdfs.map((pdf, idx) => (
                    <div key={pdf.id || idx} className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-all flex flex-col justify-between space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold truncate text-foreground">{pdf.title}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2">{pdf.description || "PDF Study Document"}</p>
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

          {/* TAB 3: OVERVIEW */}
          {activeTab === "about" && (
            <div className="space-y-4 p-6 rounded-2xl border border-border bg-card">
              <h3 className="text-lg font-bold text-foreground">About This Course</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {course.description}
              </p>
              <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>Level: <strong className="text-foreground">{course.level || "Beginner to Advanced"}</strong></span>
                <span>Instructor: <strong className="text-foreground">{teacherName}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Info & Quick Actions */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Course Quick Actions
            </h3>

            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start text-xs h-10 btn-outline"
                onClick={() => router.push(`/student/messages?courseId=${courseId}`)}
              >
                <MessageSquare className="mr-2 h-4 w-4 text-indigo-400" />
                Ask Teacher a Question
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-xs h-10 btn-outline"
                onClick={() => router.push("/student/resources")}
              >
                <FileText className="mr-2 h-4 w-4 text-amber-400" />
                View Course Resources
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-xs h-10 btn-outline"
                onClick={() => router.push("/student/live")}
              >
                <Video className="mr-2 h-4 w-4 text-sky-400" />
                Check Live Classes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
