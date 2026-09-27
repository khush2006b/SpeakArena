"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  Play,
  FileText,
  Clock,
  User,
  MessageSquare,
  BookOpen,
  Sparkles,
  Download,
  Video,
  ChevronRight,
  CheckCircle2,
  GraduationCap,
  CreditCard,
  Loader2,
  ShieldCheck,
  Globe,
  Lock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/services/api/client";
import { getCourseThumbnailUrl } from "@/lib/utils";
import { useInitiatePayment, useVerifyPayment } from "@/hooks/queries/usePaymentQueries";
import { useRazorpay } from "@/hooks/useRazorpay";
import { toast } from "sonner";

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
  is_enrolled?: boolean;
  isEnrolled?: boolean;
  enrollment_id?: string;
  enrollment_status?: string;
  price?: number;
  original_price?: number;
  usd_price?: number;
  original_usd_price?: number;
  total_lectures?: number;
  total_duration_minutes?: number;
  total_enrollments?: number;
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
  const [activeStreamUrl, setActiveStreamUrl] = React.useState<string | null>(null);

  const [isEnrolled, setIsEnrolled] = React.useState<boolean>(false);
  const [isEnrolling, setIsEnrolling] = React.useState<boolean>(false);
  const [currency, setCurrency] = React.useState<"INR" | "USD">("INR");

  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const initiatePayment = useInitiatePayment();
  const verifyPayment = useVerifyPayment();
  const { openCheckout } = useRazorpay();

  // Auto-detect visitor location: India -> INR, International -> USD
  React.useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const isIndia =
        tz.includes("Calcutta") ||
        tz.includes("Kolkata") ||
        tz.includes("Asia/Kolkata") ||
        tz.includes("IST");
      setCurrency(isIndia ? "INR" : "USD");
    } catch {
      setCurrency("INR");
    }
  }, []);

  const playVideo = React.useCallback(async (video: VideoItem) => {
    setActiveVideo(video);
    setActiveTab("content");
    document.getElementById("course-content-section")?.scrollIntoView({ behavior: "smooth" });

    // Fetch presigned stream URL from backend
    try {
      const res = await apiClient
        .get(`/api/v1/resources/${courseId}/videos/${video.id}/stream`)
        .catch(async () => {
          return await apiClient
            .get(`/api/v1/courses/${courseId}/videos/${video.id}/stream`)
            .catch(() => null);
        });
      const streamData = res?.data?.data ?? res?.data;
      const url =
        streamData?.signed_url ||
        streamData?.stream_url ||
        streamData?.url ||
        video.r2_object_key ||
        null;
      setActiveStreamUrl(url);
    } catch {
      setActiveStreamUrl(video.r2_object_key || null);
    }
  }, [courseId]);

  React.useEffect(() => {
    if (!courseId) return;

    setIsLoading(true);
    setError(null);

    // Fetch course details, videos, and pdfs using resilient endpoints
    Promise.all([
      // 1. Course details
      apiClient
        .get(`/api/v1/courses/${courseId}`)
        .then((res) => res.data?.data ?? res.data)
        .catch(async () => {
          const exploreRes = await apiClient.get("/api/v1/courses/explore?page=1&page_size=100");
          const items = exploreRes.data?.items ?? exploreRes.data?.data ?? exploreRes.data ?? [];
          return (
            items.find(
              (c: any) =>
                String(c.id) === String(courseId) || String(c.course_id) === String(courseId)
            ) || null
          );
        }),
      // 2. Videos (tries resources, courses, and teacher endpoints)
      apiClient
        .get(`/api/v1/resources/${courseId}/videos`)
        .then((res) => {
          const d = res.data?.data ?? res.data;
          return Array.isArray(d) ? d : [];
        })
        .catch(async () => {
          const cRes = await apiClient.get(`/api/v1/courses/${courseId}/videos`).catch(() => null);
          const cData = cRes?.data?.data ?? cRes?.data;
          if (Array.isArray(cData) && cData.length > 0) return cData;
          const tRes = await apiClient.get(`/api/v1/teacher/courses/${courseId}/videos`).catch(() => null);
          const tData = tRes?.data?.data ?? tRes?.data;
          return Array.isArray(tData) ? tData : [];
        }),
      // 3. PDFs (tries resources, courses, and teacher endpoints)
      apiClient
        .get(`/api/v1/resources/${courseId}/pdfs`)
        .then((res) => {
          const d = res.data?.data ?? res.data;
          return Array.isArray(d) ? d : [];
        })
        .catch(async () => {
          const cRes = await apiClient.get(`/api/v1/courses/${courseId}/pdfs`).catch(() => null);
          const cData = cRes?.data?.data ?? cRes?.data;
          if (Array.isArray(cData) && cData.length > 0) return cData;
          const tRes = await apiClient.get(`/api/v1/teacher/courses/${courseId}/pdfs`).catch(() => null);
          const tData = tRes?.data?.data ?? tRes?.data;
          return Array.isArray(tData) ? tData : [];
        }),
    ])
      .then(([courseData, videoList, pdfList]) => {
        if (courseData) {
          const resolvedThumb = getCourseThumbnailUrl(courseData);
          const enrolledStatus = Boolean(
            courseData.is_enrolled ||
            courseData.isEnrolled ||
            Boolean(courseData.enrollment_id) ||
            courseData.enrollment_status === "active"
          );
          setIsEnrolled(enrolledStatus);

          setCourse({
            id: String(courseData.id || courseData.course_id || courseId),
            title: courseData.title || "Course Details",
            description: courseData.description || courseData.short_description || "",
            level: courseData.level || "All Levels",
            category: courseData.category || "General",
            teacher_name:
              courseData.teacher_name ||
              courseData.teacherName ||
              courseData.teacher?.full_name ||
              "Speak Arena Instructor",
            total_lectures: courseData.total_lectures || (Array.isArray(videoList) ? videoList.length : 0),
            price: courseData.price !== undefined ? Number(courseData.price) : 0,
            original_price: courseData.original_price ? Number(courseData.original_price) : undefined,
            usd_price: courseData.usd_price ? Number(courseData.usd_price) : undefined,
            original_usd_price: courseData.original_usd_price ? Number(courseData.original_usd_price) : undefined,
            total_enrollments: courseData.total_enrollments || courseData.enrolled_count || 0,
            ...courseData,
            // Must come AFTER spread — resolvedThumb is the full URL, not the raw R2 key
            thumbnail_r2_key: resolvedThumb,
          });
        } else {
          setError("Course details not found.");
        }

        if (Array.isArray(videoList)) {
          setVideos(videoList);
          if (videoList.length > 0) {
            playVideo(videoList[0]);
          }
        }
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
  }, [courseId, playVideo]);

  const teacherName = course?.teacher_name || course?.teacherName || "Paras (Construction)";

  const isFree = !course?.price || Number(course.price) === 0;

  const displayPrice = React.useMemo(() => {
    if (!course) return "Free";
    if (isFree) return "Free";
    if (currency === "USD") {
      const usdVal = course.usd_price;
      const finalUsd = usdVal != null && usdVal > 0 ? usdVal : Math.max(Math.ceil((course.price || 0) / 80), 1);
      return `$${finalUsd}`;
    }
    return `₹${Number(course.price || 0).toLocaleString("en-IN")}`;
  }, [course, isFree, currency]);

  const displayOriginalPrice = React.useMemo(() => {
    if (!course) return null;
    if (currency === "USD" && course.original_usd_price) {
      return `$${course.original_usd_price}`;
    }
    if (course.original_price && course.original_price > (course.price || 0)) {
      return `₹${Number(course.original_price).toLocaleString("en-IN")}`;
    }
    return null;
  }, [course, currency]);

  const handleEnroll = async () => {
    if (!course) return;
    setIsEnrolling(true);

    try {
      if (isFree) {
        // Free Course Enrollment
        await apiClient
          .post("/api/v1/payments/enroll-free", { course_id: course.id, currency })
          .catch(async () => {
            return await apiClient.post(`/api/v1/courses/${course.id}/enroll`);
          });

        setIsEnrolled(true);
        toast.success(`🎉 Successfully enrolled in "${course.title}"! You can start learning now.`);
        return;
      }

      // Paid Course: Razorpay Flow
      const orderData = await initiatePayment.mutateAsync({ courseId: course.id, currency });

      const paymentResult = await openCheckout({
        keyId: orderData.keyId ?? (process.env["NEXT_PUBLIC_RAZORPAY_KEY_ID"] || ""),
        orderId: orderData.orderId,
        amount: orderData.amount,
        currency: orderData.currency ?? currency,
        courseName: orderData.courseName ?? course.title,
        studentName: orderData.studentName ?? "",
        studentEmail: orderData.studentEmail ?? "",
      });

      await verifyPayment.mutateAsync({
        razorpayOrderId: paymentResult.razorpay_order_id,
        razorpayPaymentId: paymentResult.razorpay_payment_id,
        razorpaySignature: paymentResult.razorpay_signature,
      });

      setIsEnrolled(true);
      toast.success(`🎉 Payment successful! You are now enrolled in "${course.title}".`);
    } catch (err: any) {
      if (err?.message === "Payment cancelled by user.") {
        return;
      }
      console.error("Enrollment failed:", err);
      toast.error(err?.response?.data?.message || err?.message || "Enrollment failed. Please try again.");
    } finally {
      setIsEnrolling(false);
    }
  };

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
          {/* Currency Switcher */}
          {!isFree && (
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setCurrency("INR")}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  currency === "INR" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ₹ INR
              </button>
              <button
                type="button"
                onClick={() => setCurrency("USD")}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  currency === "USD" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                $ USD
              </button>
            </div>
          )}

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

              {/* Enrollment Badge */}
              {isEnrolled ? (
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Enrolled
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5" /> Ready to Enroll
                </span>
              )}
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
          <div className="flex flex-col gap-4 bg-black/40 p-5 rounded-2xl border border-white/10 backdrop-blur-md">
            <div
              onClick={() => {
                if (videos.length > 0) {
                  playVideo(videos[0]);
                } else {
                  toast.info("No video lectures uploaded for this course yet.");
                }
              }}
              className="relative aspect-video rounded-xl overflow-hidden border border-white/15 shadow-2xl bg-black/60"
            >
              <Image
                src={course.thumbnail_r2_key || THUMBNAIL_FALLBACK}
                alt={course.title}
                fill
                className="object-cover"
                unoptimized
              />
            </div>

            {/* Price & Action Area */}
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-foreground">{displayPrice}</span>
                  {displayOriginalPrice && (
                    <span className="text-sm text-muted-foreground line-through font-medium">
                      {displayOriginalPrice}
                    </span>
                  )}
                </div>
                {isEnrolled ? (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded">
                    <CheckCircle2 className="h-3 w-3" /> Active Access
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Full Lifetime Access</span>
                )}
              </div>

              {/* ENROLL OR START LEARNING BUTTON */}
              {isEnrolled ? (
                <Button
                  className="w-full h-12 text-base font-bold btn-primary shadow-lg"
                  style={{ borderRadius: 12 }}
                  onClick={() => {
                    if (videos.length > 0) {
                      playVideo(videos[0]);
                    } else {
                      toast.info("No video lectures have been uploaded for this course yet.");
                    }
                  }}
                >
                  <Play className="mr-2 h-5 w-5 fill-current" />
                  Start Learning Now
                </Button>
              ) : (
                <Button
                  className="w-full h-12 text-base font-bold shadow-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  style={{ borderRadius: 12 }}
                  disabled={isEnrolling}
                  onClick={handleEnroll}
                >
                  {isEnrolling ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Enrolling...
                    </>
                  ) : (
                    <>
                      <GraduationCap className="mr-2 h-5 w-5" />
                      {isFree ? "Enroll in Course (Free)" : `Enroll Now • ${displayPrice}`}
                    </>
                  )}
                </Button>
              )}

              <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Instant access • Includes all lectures & guides
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── COURSE CONTENT & LESSONS SECTION ───────────────────────────── */}
      <div id="course-content-section" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
              Course Overview &amp; Enroll
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
                {activeStreamUrl || activeVideo.r2_object_key ? (
                  <video
                    key={activeStreamUrl || activeVideo.id}
                    src={activeStreamUrl || activeVideo.r2_object_key}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-6 space-y-2">
                    <Video className="h-12 w-12 text-muted-foreground mx-auto opacity-50" />
                    <p className="text-sm font-medium text-foreground">{activeVideo.title}</p>
                    <p className="text-xs text-muted-foreground">Loading video stream...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 1: VIDEO LECTURES */}
          {activeTab === "content" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary" /> Lectures Curriculum
                </h3>
                {!isEnrolled && (
                  <Button
                    size="sm"
                    className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
                    disabled={isEnrolling}
                    onClick={handleEnroll}
                  >
                    <GraduationCap className="h-3.5 w-3.5" />
                    Enroll to Unlock All
                  </Button>
                )}
              </div>

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
                        onClick={() => playVideo(vid)}
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
                <FileText className="h-5 w-5 text-amber-400" /> Study Guides &amp; Resource Documents
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

          {/* TAB 3: OVERVIEW & ENROLL INFO */}
          {activeTab === "about" && (
            <div className="space-y-6">
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

              {/* Enrollment Callout Card if not enrolled */}
              {!isEnrolled && (
                <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h4 className="text-base font-bold text-emerald-300">Ready to start mastering English?</h4>
                      <p className="text-xs text-muted-foreground">
                        Enroll today to get access to all lectures, class discussions, and downloadable study guides.
                      </p>
                    </div>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-6 h-11 shadow-lg"
                      disabled={isEnrolling}
                      onClick={handleEnroll}
                    >
                      {isEnrolling ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <GraduationCap className="h-4 w-4 mr-2" />
                      )}
                      {isFree ? "Enroll for Free" : `Enroll Now • ${displayPrice}`}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Info & Quick Actions */}
        <div className="space-y-6">
          {/* Enrollment / Status Card */}
          <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Enrollment Status
            </h3>

            {isEnrolled ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Enrolled &amp; Active</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  You have full access to this course material.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Course Fee:</span>
                    <span className="text-lg font-bold text-foreground">{displayPrice}</span>
                  </div>
                  <Button
                    className="w-full text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white h-10 shadow-md"
                    disabled={isEnrolling}
                    onClick={handleEnroll}
                  >
                    {isEnrolling ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <GraduationCap className="h-4 w-4 mr-2" />
                    )}
                    {isFree ? "Enroll in Course (Free)" : `Enroll Now (${displayPrice})`}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-border">
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
