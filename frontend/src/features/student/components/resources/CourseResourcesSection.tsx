"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  PlayCircle,
  FileText,
  CheckCircle2,
  Download,
  Clock,
  HardDrive,
  BookOpen,
  Loader2,
} from "lucide-react";
import { StudentCourse, CourseVideo, CoursePDF } from "../../hooks/useStudentResources";
import { apiClient } from "@/services/api/client";
import { toast } from "sonner";

interface CourseResourcesSectionProps {
  course: StudentCourse;
  videos: CourseVideo[];
  pdfs: CoursePDF[];
  searchQuery: string;
}

function formatDuration(seconds: number = 0) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSize(bytes: number = 0) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CourseResourcesSection({
  course,
  videos,
  pdfs,
  searchQuery,
}: CourseResourcesSectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<"videos" | "pdfs">("videos");
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const handleDownloadVideo = async (video: CourseVideo) => {
    try {
      setDownloadingId(video.id);
      toast.info(`Preparing download for "${video.title}"...`);
      const res = await apiClient.get(`/api/v1/videos/${course.courseId}/${video.id}/stream`);
      const streamUrl =
        res.data?.data?.stream_url ||
        res.data?.stream_url ||
        res.data?.data?.url ||
        res.data?.url;
      if (!streamUrl) {
        toast.error("Download link is unavailable.");
        return;
      }
      const a = document.createElement("a");
      a.href = streamUrl;
      a.download = `${video.title || "video"}.mp4`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Download started for "${video.title}".`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to download video.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadPdf = async (pdf: CoursePDF) => {
    try {
      setDownloadingId(pdf.id);
      toast.info(`Preparing download for "${pdf.title}"...`);
      const res = await apiClient.get(`/api/v1/pdfs/${pdf.id}/access`);
      const accessUrl =
        res.data?.data?.url ||
        res.data?.url ||
        res.data?.data?.access_url ||
        res.data?.access_url;
      if (!accessUrl) {
        toast.error("Download link is unavailable.");
        return;
      }
      const a = document.createElement("a");
      a.href = accessUrl;
      a.download = `${pdf.title || "document"}.pdf`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Download started for "${pdf.title}".`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to download PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredVideos = videos.filter((v) =>
    v.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredPdfs = pdfs.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (searchQuery && filteredVideos.length === 0 && filteredPdfs.length === 0) {
    return null;
  }

  return (
    <div className="card-glass overflow-hidden mb-6 hover-lift">
      {/* Course Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`p-5 flex items-center justify-between cursor-pointer bg-card/30 transition-colors hover:bg-card/50 ${
          isExpanded ? "border-b border-border/50" : ""
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center text-primary border border-primary/20">
            <BookOpen size={22} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {course.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Instructor: {course.teacherName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${course.progressPercentage}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {course.progressPercentage}%
            </span>
          </div>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-5">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-border/50 mb-4">
            <TabButton
              active={activeTab === "videos"}
              onClick={() => setActiveTab("videos")}
              icon={<PlayCircle size={15} />}
              label={`Videos (${filteredVideos.length})`}
            />
            <TabButton
              active={activeTab === "pdfs"}
              onClick={() => setActiveTab("pdfs")}
              icon={<FileText size={15} />}
              label={`PDFs (${filteredPdfs.length})`}
            />
          </div>

          {/* Tab Content */}
          <div className="flex flex-col gap-3">
            {activeTab === "videos" &&
              (filteredVideos.length > 0 ? (
                filteredVideos.map((video) => (
                  <div
                    key={video.id}
                    className="flex items-center justify-between p-3 sm:p-4 bg-card/30 rounded-xl border border-border/40 hover:border-border transition-colors"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <div className="w-10 h-10 shrink-0 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
                        <PlayCircle size={18} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium text-foreground truncate">
                          {video.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock size={11} /> {formatDuration(video.durationSeconds)}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <HardDrive size={11} /> {formatSize(video.fileSizeBytes)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      {video.isCompleted && (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      )}
                      <button
                        onClick={() => handleDownloadVideo(video)}
                        disabled={downloadingId === video.id}
                        className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors press-scale flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {downloadingId === video.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Download size={13} />
                        )}
                        Download Video
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No videos found.
                </div>
              ))}

            {activeTab === "pdfs" &&
              (filteredPdfs.length > 0 ? (
                filteredPdfs.map((pdf) => (
                  <div
                    key={pdf.id}
                    className="flex items-center justify-between p-3 sm:p-4 bg-card/30 rounded-xl border border-border/40 hover:border-border transition-colors"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <div className="w-10 h-10 shrink-0 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium text-foreground truncate">
                          {pdf.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {pdf.pageCount || 0} pages
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <HardDrive size={11} /> {formatSize(pdf.fileSizeBytes)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {pdf.isCompleted && (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      )}
                      <button
                        onClick={() => handleDownloadPdf(pdf)}
                        disabled={downloadingId === pdf.id}
                        className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors press-scale flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {downloadingId === pdf.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Download size={13} />
                        )}
                        Download PDF
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No PDFs found.
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px press-scale ${
        active
          ? "text-primary border-primary"
          : "text-muted-foreground border-transparent hover:text-foreground"
      }`}
    >
      {icon} {label}
    </button>
  );
}
