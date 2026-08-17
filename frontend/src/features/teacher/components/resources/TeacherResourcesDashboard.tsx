"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload, Video, FileText, Trash2, RefreshCw,
  Loader2, AlertCircle, CheckCircle2, Plus, X
} from "lucide-react";
import { apiClient } from "@/services/api/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface Course {
  id: string;
  title: string;
  status: string;
  total_lectures: number;
  enrolled_count: number;
  price: number;
}

interface Video {
  id: string;
  title: string;
  description?: string;
  sort_order: number;
  section?: string;
  duration_seconds?: number;
  file_size_bytes?: number;
  processing_status: string;
  upload_status: string;
  created_at: string;
}

interface Pdf {
  id: string;
  title: string;
  sort_order: number;
  section?: string;
  file_size_bytes?: number;
  upload_status: string;
  created_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toArray<T>(raw: any): T[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes === 0) return "–";
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${["B", "KB", "MB", "GB"][i]}`;
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toUpperCase() ?? "";
  const map: Record<string, string> = {
    PENDING: "bg-zinc-500/20 text-zinc-400",
    PROCESSING: "bg-amber-500/20 text-amber-400",
    READY: "bg-emerald-500/20 text-emerald-400",
    COMPLETE: "bg-emerald-500/20 text-emerald-400",
    FAILED: "bg-red-500/20 text-red-400",
  };
  return (
    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", map[s] ?? "bg-zinc-500/20 text-zinc-400")}>
      {s || "UNKNOWN"}
    </span>
  );
}

// ── Upload Modal ──────────────────────────────────────────────────────────────

interface UploadModalProps {
  courseId: string;
  uploadType: "video" | "pdf";
  onClose: () => void;
  onSuccess: () => void;
}

function UploadModal({ courseId, uploadType, onClose, onSuccess }: UploadModalProps) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"form" | "uploading" | "done">("form");
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;

    setPhase("uploading");
    setError(null);
    setProgress(0);

    try {
      if (uploadType === "video") {
        // Step 1: Create video record → get presigned URL
        const { data: createRes } = await apiClient.post(
          `/api/v1/teacher/courses/${courseId}/videos`,
          {
            title: title.trim(),
            section: "Module 1",
            sort_order: 1,
            visibility: "private",
            is_free_preview: false,
            mime_type: file.type || "video/mp4",
          }
        );
        const videoId = createRes?.data?.video?.id ?? createRes?.video?.id;
        const videoUploadUrl = createRes?.data?.upload_url ?? createRes?.upload_url;

        // Step 2: Upload directly to R2
        if (videoUploadUrl) {
          const putRes = await fetch(videoUploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type || "video/mp4" },
            body: file,
          });
          if (!putRes.ok) throw new Error(`Storage upload failed (${putRes.status})`);
        }

        // Step 3: Confirm
        if (videoId) {
          await apiClient.post(
            `/api/v1/teacher/courses/${courseId}/videos/${videoId}/confirm`,
            { file_size_bytes: file.size, duration_seconds: 0 }
          );
        }
      } else {
        // Step 1: Create PDF record → get presigned URL
        const { data: createRes } = await apiClient.post(
          `/api/v1/teacher/courses/${courseId}/pdfs`,
          {
            title: title.trim(),
            section: "Module 1",
            sort_order: 1,
            visibility: "private",
            is_downloadable: true,
            is_free_preview: false,
            file_size_bytes: file.size,
            mime_type: file.type || "application/pdf",
          }
        );
        const pdfId = createRes?.data?.pdf?.id ?? createRes?.pdf?.id;
        const pdfUploadUrl = createRes?.data?.upload_url ?? createRes?.upload_url;

        // Step 2: Upload directly to R2
        if (pdfUploadUrl) {
          const putRes = await fetch(pdfUploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type || "application/pdf" },
            body: file,
          });
          if (!putRes.ok) throw new Error(`Storage upload failed (${putRes.status})`);
        }

        // Step 3: Confirm
        if (pdfId) {
          await apiClient.post(
            `/api/v1/teacher/courses/${courseId}/pdfs/${pdfId}/confirm`
          );
        }
      }

      setPhase("done");
      setProgress(100);
      toast.success(`"${title}" uploaded successfully!`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d: any) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(" | ")
        : detail ?? err?.message ?? "Upload failed. Please try again.";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
      setPhase("form");
    }
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md card-glass rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-foreground">
            Upload {uploadType === "video" ? "Video" : "PDF"}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {phase === "form" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={uploadType === "video" ? "e.g. Introduction to Phonetics" : "e.g. Study Guide Week 1"}
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">File</label>
              <label className={cn(
                "flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed cursor-pointer transition-all",
                file ? "border-primary/50 bg-primary/5" : "border-border/60 bg-secondary/20 hover:bg-secondary/40 hover:border-primary/30"
              )}>
                <input
                  type="file"
                  className="hidden"
                  accept={uploadType === "video" ? "video/*,.mp4,.webm,.mov" : "application/pdf,.pdf"}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <div className="flex flex-col items-center gap-1 px-4 text-center">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                    <span className="text-sm font-medium text-foreground truncate max-w-[240px]">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {uploadType === "video" ? "MP4, WebM, MOV" : "PDF"}
                    </span>
                  </div>
                )}
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 h-10 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-secondary/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!file || !title.trim()}
                className="flex-1 h-10 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >
                Upload
              </button>
            </div>
          </form>
        )}

        {phase === "uploading" && (
          <div className="space-y-6 py-2">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-border/50">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                {uploadType === "video" ? (
                  <Video className="h-5 w-5 text-primary" />
                ) : (
                  <FileText className="h-5 w-5 text-orange-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{title}</p>
                <p className="text-xs text-muted-foreground">{file ? formatBytes(file.size) : ""}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-foreground font-medium">Uploading...</span>
                <span className="text-primary font-bold">{progress}%</span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <button
              onClick={handleCancel}
              className="w-full h-10 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
            >
              Cancel Upload
            </button>
          </div>
        )}

        {phase === "done" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="text-base font-bold text-foreground">Upload Complete!</p>
            <p className="text-sm text-muted-foreground text-center">
              "{title}" has been uploaded and is being processed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function TeacherResourcesDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const [videos, setVideos] = useState<Video[]>([]);
  const [pdfs, setPdfs] = useState<Pdf[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadModal, setUploadModal] = useState<"video" | "pdf" | null>(null);

  // ── Load courses ──────────────────────────────────────────────────
  const fetchCourses = useCallback(async () => {
    try {
      setLoadingCourses(true);
      const res = await apiClient.get("/api/v1/teacher/courses?page=1&page_size=100");
      const fetched = toArray<Course>(res.data);
      setCourses(fetched);
      if (fetched.length > 0) setSelectedCourseId(fetched[0].id);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load courses.");
      setCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  // ── Load resources for selected course ───────────────────────────
  const fetchResources = useCallback(async (courseId: string) => {
    try {
      setLoadingResources(true);
      setError(null);
      // Use allSettled so a 500 on one endpoint doesn't wipe both lists
      const [vResult, pResult] = await Promise.allSettled([
        apiClient.get(`/api/v1/teacher/courses/${courseId}/videos`),
        apiClient.get(`/api/v1/teacher/courses/${courseId}/pdfs`),
      ]);
      setVideos(vResult.status === "fulfilled" ? toArray<Video>(vResult.value.data) : []);
      setPdfs(pResult.status === "fulfilled" ? toArray<Pdf>(pResult.value.data) : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load resources.");
    } finally {
      setLoadingResources(false);
    }
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);
  useEffect(() => {
    if (selectedCourseId) fetchResources(selectedCourseId);
    else { setVideos([]); setPdfs([]); }
  }, [selectedCourseId, fetchResources]);

  // ── Delete helpers ────────────────────────────────────────────────
  const deleteVideo = async (id: string) => {
    if (!selectedCourseId) return;
    setVideos((prev) => prev.filter((v) => v.id !== id));
    try {
      await apiClient.delete(`/api/v1/teacher/courses/${selectedCourseId}/videos/${id}`);
      toast.success("Video deleted.");
    } catch {
      toast.error("Failed to delete video.");
      fetchResources(selectedCourseId);
    }
  };

  const deletePdf = async (id: string) => {
    if (!selectedCourseId) return;
    setPdfs((prev) => prev.filter((p) => p.id !== id));
    try {
      await apiClient.delete(`/api/v1/teacher/courses/${selectedCourseId}/pdfs/${id}`);
      toast.success("PDF deleted.");
    } catch {
      toast.error("Failed to delete PDF.");
      fetchResources(selectedCourseId);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Course Resources</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage videos and PDFs for each of your courses.
            </p>
          </div>
          <button
            onClick={fetchCourses}
            disabled={loadingCourses}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-border hover:bg-secondary/40 transition-colors"
          >
            <RefreshCw className={cn("h-4 w-4", loadingCourses && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Course Tabs */}
        {loadingCourses ? (
          <div className="flex items-center gap-3 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading your courses...</span>
          </div>
        ) : courses.length === 0 ? (
          <div className="card-glass rounded-2xl p-12 text-center">
            <Video className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="font-semibold text-foreground">No courses yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a course in the Course Builder first.
            </p>
          </div>
        ) : (
          <>
            {/* Course selector tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => setSelectedCourseId(course.id)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border transition-all",
                    selectedCourseId === course.id
                      ? "border-primary/60 bg-primary/10 text-violet-400"
                      : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  {course.title}
                </button>
              ))}
            </div>

            {/* Resources */}
            {loadingResources ? (
              <div className="flex items-center gap-3 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading resources...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Videos */}
                <ResourceSection
                  title="Videos"
                  count={videos.length}
                  icon={<Video className="h-5 w-5 text-primary" />}
                  onUpload={() => setUploadModal("video")}
                  uploadLabel="Upload Video"
                >
                  {videos.length === 0 ? (
                    <EmptyState
                      icon={<Video className="h-8 w-8 text-muted-foreground/30" />}
                      label="No videos uploaded yet"
                      action={() => setUploadModal("video")}
                      actionLabel="Upload your first video"
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/50 text-muted-foreground text-xs uppercase tracking-wider">
                            <th className="px-4 py-3 text-left font-semibold">Title</th>
                            <th className="px-4 py-3 text-left font-semibold">Size</th>
                            <th className="px-4 py-3 text-left font-semibold">Status</th>
                            <th className="px-4 py-3 text-left font-semibold">Date</th>
                            <th className="px-4 py-3 w-10" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {videos.map((vid) => (
                            <tr key={vid.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-4 py-3 font-medium text-foreground max-w-[220px] truncate">{vid.title}</td>
                              <td className="px-4 py-3 text-muted-foreground">{formatBytes(vid.file_size_bytes)}</td>
                              <td className="px-4 py-3">
                                <StatusBadge status={vid.upload_status === "READY" ? vid.processing_status : vid.upload_status} />
                              </td>
                              <td className="px-4 py-3 text-muted-foreground text-xs">
                                {new Date(vid.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => deleteVideo(vid.id)}
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </ResourceSection>

                {/* PDFs */}
                <ResourceSection
                  title="PDFs"
                  count={pdfs.length}
                  icon={<FileText className="h-5 w-5 text-orange-400" />}
                  onUpload={() => setUploadModal("pdf")}
                  uploadLabel="Upload PDF"
                >
                  {pdfs.length === 0 ? (
                    <EmptyState
                      icon={<FileText className="h-8 w-8 text-muted-foreground/30" />}
                      label="No PDFs uploaded yet"
                      action={() => setUploadModal("pdf")}
                      actionLabel="Upload your first PDF"
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/50 text-muted-foreground text-xs uppercase tracking-wider">
                            <th className="px-4 py-3 text-left font-semibold">Title</th>
                            <th className="px-4 py-3 text-left font-semibold">Size</th>
                            <th className="px-4 py-3 text-left font-semibold">Status</th>
                            <th className="px-4 py-3 text-left font-semibold">Date</th>
                            <th className="px-4 py-3 w-10" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {pdfs.map((pdf) => (
                            <tr key={pdf.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-4 py-3 font-medium text-foreground max-w-[220px] truncate">{pdf.title}</td>
                              <td className="px-4 py-3 text-muted-foreground">{formatBytes(pdf.file_size_bytes)}</td>
                              <td className="px-4 py-3">
                                <StatusBadge status={pdf.upload_status} />
                              </td>
                              <td className="px-4 py-3 text-muted-foreground text-xs">
                                {new Date(pdf.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => deletePdf(pdf.id)}
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </ResourceSection>
              </div>
            )}
          </>
        )}
      </div>

      {/* Upload Modal */}
      {uploadModal && selectedCourseId && (
        <UploadModal
          courseId={selectedCourseId}
          uploadType={uploadModal}
          onClose={() => setUploadModal(null)}
          onSuccess={() => {
            setUploadModal(null);
            if (selectedCourseId) fetchResources(selectedCourseId);
          }}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ResourceSection({
  title, count, icon, onUpload, uploadLabel, children,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  onUpload: () => void;
  uploadLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          {icon}
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/15 text-violet-400">
            {count}
          </span>
        </div>
        <button
          onClick={onUpload}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/25 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {uploadLabel}
        </button>
      </div>
      <div>{children}</div>
    </div>
  );
}

function EmptyState({
  icon, label, action, actionLabel,
}: {
  icon: React.ReactNode;
  label: string;
  action: () => void;
  actionLabel: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      {icon}
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <button
        onClick={action}
        className="text-xs font-semibold text-primary hover:underline underline-offset-2"
      >
        {actionLabel}
      </button>
    </div>
  );
}
