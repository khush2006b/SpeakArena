"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  FileText,
  CheckCircle2,
  Download,
  Clock,
  HardDrive,
  BookOpen,
  Loader2,
  LayoutGrid,
  List,
  Calendar,
} from "lucide-react";
import { StudentCourse, CourseVideo, CoursePDF } from "../../hooks/useStudentResources";
import { apiClient } from "@/services/api/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  if (!bytes || bytes === 0) return "–";
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
  const [viewMode, setViewMode] = React.useState<"list" | "carousel">("list");
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const scrollRef = React.useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -300 : 300;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

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

  const filteredVideos = React.useMemo(() => {
    return videos.filter((v) =>
      v.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [videos, searchQuery]);

  const filteredPdfs = React.useMemo(() => {
    return pdfs.filter((p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [pdfs, searchQuery]);

  // Sort resources newest first (newest resource on top)
  const sortedVideos = React.useMemo(() => {
    return [...filteredVideos].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA && timeB) return timeB - timeA;
      return String(b.id).localeCompare(String(a.id));
    });
  }, [filteredVideos]);

  const sortedPdfs = React.useMemo(() => {
    return [...filteredPdfs].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA && timeB) return timeB - timeA;
      return String(b.id).localeCompare(String(a.id));
    });
  }, [filteredPdfs]);

  if (searchQuery && sortedVideos.length === 0 && sortedPdfs.length === 0) {
    return null;
  }

  return (
    <div className="card-glass overflow-hidden rounded-2xl border border-border/50 shadow-lg transition-all hover:border-primary/30">
      {/* Course Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "p-5 flex items-center justify-between cursor-pointer bg-card/40 transition-colors hover:bg-card/60 select-none",
          isExpanded && "border-b border-border/50"
        )}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center text-primary border border-primary/25 shadow-sm">
            <BookOpen size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              {course.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              Instructor: {course.teacherName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${course.progressPercentage}%` }}
              />
            </div>
            <span className="text-xs font-bold text-muted-foreground">
              {course.progressPercentage}%
            </span>
          </div>
          <button className="text-muted-foreground hover:text-foreground transition-colors p-1">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-5 space-y-5">
          {/* Controls Bar: Tabs + Slide Arrows + Layout Toggle */}
          <div className="flex items-center justify-between border-b border-border/50 pb-3 flex-wrap gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("videos")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all press-scale",
                  activeTab === "videos"
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40 border border-transparent"
                )}
              >
                <PlayCircle size={15} />
                <span>Videos ({sortedVideos.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("pdfs")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all press-scale",
                  activeTab === "pdfs"
                    ? "bg-orange-500/15 text-orange-400 border border-orange-500/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40 border border-transparent"
                )}
              >
                <FileText size={15} />
                <span>PDFs ({sortedPdfs.length})</span>
              </button>
            </div>

            {/* Slide Arrows & View Mode */}
            <div className="flex items-center gap-2">
              {viewMode === "carousel" && (
                <div className="flex items-center gap-1 bg-secondary/30 rounded-xl p-1 border border-border/40">
                  <button
                    onClick={() => scroll("left")}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                    title="Slide Left"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => scroll("right")}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                    title="Slide Right"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1 bg-secondary/30 rounded-xl p-1 border border-border/40">
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "p-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1",
                    viewMode === "list"
                      ? "bg-primary text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Vertical List View"
                >
                  <List size={14} />
                  <span className="hidden sm:inline">List</span>
                </button>
                <button
                  onClick={() => setViewMode("carousel")}
                  className={cn(
                    "p-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1",
                    viewMode === "carousel"
                      ? "bg-primary text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Sliding Cards View"
                >
                  <LayoutGrid size={14} />
                  <span className="hidden sm:inline">Sliding</span>
                </button>
              </div>
            </div>
          </div>

          {/* Videos Tab Content */}
          {activeTab === "videos" && (
            sortedVideos.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground bg-card/20 rounded-2xl border border-dashed border-border/40">
                <PlayCircle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                No video resources available for this course.
              </div>
            ) : viewMode === "list" ? (
              /* Vertical Fashion List View with Horizontal Details */
              <div className="flex flex-col gap-2.5">
                {sortedVideos.map((video) => (
                  <div
                    key={video.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 bg-card/30 hover:bg-card/60 rounded-xl border border-border/40 hover:border-border transition-all gap-3"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-10 h-10 shrink-0 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
                        <PlayCircle size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-foreground truncate">
                          {video.title}
                        </h4>
                        {video.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {video.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-5 text-xs text-muted-foreground shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/40">
                      <span className="flex items-center gap-1 font-medium">
                        <Clock size={12} className="text-muted-foreground/70" />
                        {formatDuration(video.durationSeconds)}
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <HardDrive size={12} className="text-muted-foreground/70" />
                        {formatSize(video.fileSizeBytes)}
                      </span>
                      {video.createdAt && (
                        <span className="hidden md:flex items-center gap-1 text-[11px] font-medium text-muted-foreground/80">
                          <Calendar size={12} className="text-muted-foreground/70" />
                          {new Date(video.createdAt).toLocaleDateString()}
                        </span>
                      )}
                      {video.isCompleted && (
                        <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                          <CheckCircle2 size={12} /> Watched
                        </span>
                      )}

                      <button
                        onClick={() => handleDownloadVideo(video)}
                        disabled={downloadingId === video.id}
                        className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-semibold hover:bg-primary/20 transition-all press-scale flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {downloadingId === video.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Download size={13} />
                        )}
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Sliding Cards Layout */
              <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto pb-4 pt-1 scrollbar-none no-scrollbar touch-pan-x snap-x"
              >
                {sortedVideos.map((video) => (
                  <div
                    key={video.id}
                    className="flex flex-col justify-between p-4 bg-card/40 hover:bg-card/70 rounded-2xl border border-border/50 transition-all w-[270px] sm:w-[290px] shrink-0 snap-start shadow-md hover:shadow-xl hover:border-primary/40 group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center text-red-500 border border-red-500/20 group-hover:scale-105 transition-transform">
                          <PlayCircle size={20} />
                        </div>
                        {video.isCompleted && (
                          <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                            <CheckCircle2 size={12} /> Watched
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                          {video.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground font-medium">
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {formatDuration(video.durationSeconds)}
                          </span>
                          <span className="flex items-center gap-1">
                            <HardDrive size={12} /> {formatSize(video.fileSizeBytes)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-4 mt-3 border-t border-border/40">
                      <button
                        onClick={() => handleDownloadVideo(video)}
                        disabled={downloadingId === video.id}
                        className="w-full py-2 bg-primary/10 text-primary border border-primary/25 rounded-xl text-xs font-bold hover:bg-primary/20 transition-all press-scale flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {downloadingId === video.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Download size={14} />
                        )}
                        Download Video
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* PDFs Tab Content */}
          {activeTab === "pdfs" && (
            sortedPdfs.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground bg-card/20 rounded-2xl border border-dashed border-border/40">
                <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                No PDF resources available for this course.
              </div>
            ) : viewMode === "list" ? (
              /* Vertical Fashion List View with Horizontal Details */
              <div className="flex flex-col gap-2.5">
                {sortedPdfs.map((pdf) => (
                  <div
                    key={pdf.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 bg-card/30 hover:bg-card/60 rounded-xl border border-border/40 hover:border-border transition-all gap-3"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-10 h-10 shrink-0 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 border border-orange-500/20">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-foreground truncate">
                          {pdf.title}
                        </h4>
                        {pdf.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {pdf.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-5 text-xs text-muted-foreground shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/40">
                      <span className="flex items-center gap-1 font-medium">
                        <HardDrive size={12} className="text-muted-foreground/70" />
                        {formatSize(pdf.fileSizeBytes)}
                      </span>
                      {pdf.createdAt && (
                        <span className="hidden md:flex items-center gap-1 text-[11px] font-medium text-muted-foreground/80">
                          <Calendar size={12} className="text-muted-foreground/70" />
                          {new Date(pdf.createdAt).toLocaleDateString()}
                        </span>
                      )}
                      {pdf.isCompleted && (
                        <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                          <CheckCircle2 size={12} /> Read
                        </span>
                      )}

                      <button
                        onClick={() => handleDownloadPdf(pdf)}
                        disabled={downloadingId === pdf.id}
                        className="px-3 py-1.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg text-xs font-semibold hover:bg-orange-500/20 transition-all press-scale flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {downloadingId === pdf.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Download size={13} />
                        )}
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Sliding Cards Layout */
              <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto pb-4 pt-1 scrollbar-none no-scrollbar touch-pan-x snap-x"
              >
                {sortedPdfs.map((pdf) => (
                  <div
                    key={pdf.id}
                    className="flex flex-col justify-between p-4 bg-card/40 hover:bg-card/70 rounded-2xl border border-border/50 transition-all w-[270px] sm:w-[290px] shrink-0 snap-start shadow-md hover:shadow-xl hover:border-primary/40 group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center text-orange-400 border border-orange-500/20 group-hover:scale-105 transition-transform">
                          <FileText size={20} />
                        </div>
                        {pdf.isCompleted && (
                          <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                            <CheckCircle2 size={12} /> Read
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground line-clamp-2 leading-tight group-hover:text-orange-400 transition-colors">
                          {pdf.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground font-medium">
                          <span className="flex items-center gap-1">
                            <HardDrive size={12} /> {formatSize(pdf.fileSizeBytes)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-4 mt-3 border-t border-border/40">
                      <button
                        onClick={() => handleDownloadPdf(pdf)}
                        disabled={downloadingId === pdf.id}
                        className="w-full py-2 bg-orange-500/10 text-orange-400 border border-orange-500/25 rounded-xl text-xs font-bold hover:bg-orange-500/20 transition-all press-scale flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {downloadingId === pdf.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Download size={14} />
                        )}
                        Download PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
