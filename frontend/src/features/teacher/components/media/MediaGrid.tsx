"use client";

import * as React from "react";
import { 
  MoreVertical, 
  Video, 
  FileText, 
  Image as ImageIcon,
  PlayCircle,
  Eye,
  Trash2,
  FolderOpen
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMediaStore, MediaItem } from "@/stores/media.store";
import { apiClient } from "@/services/api/client";

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function MediaCard({ item }: { item: MediaItem }) {
  const { setActiveFile } = useMediaStore();

  const isVideo = item.type === "video";
  const isPDF = item.type === "pdf";
  const isFailed = item.status === "Failed";
  const isProcessing = item.status === "Processing";

  return (
    <div
      className="card-glass hover-lift group relative h-full flex flex-col overflow-hidden cursor-pointer animate-fade-up"
      onClick={() => setActiveFile(item)}
    >
      {/* Thumbnail Area */}
      <div className="relative aspect-video w-full overflow-hidden bg-secondary/30 flex items-center justify-center">
        {item.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail}
            alt={item.filename}
            className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground/50 transition-transform duration-500 group-hover:scale-110 group-hover:text-muted-foreground/80">
            {isVideo && <Video className="h-10 w-10 mb-2 text-blue-400/60" />}
            {isPDF && <FileText className="h-10 w-10 mb-2 text-orange-400/60" />}
            {!isVideo && !isPDF && <ImageIcon className="h-10 w-10 mb-2 text-emerald-400/60" />}
            <span className="text-[10px] font-bold uppercase tracking-widest">{item.type}</span>
          </div>
        )}

        {/* Actions dropdown */}
        <div className="absolute right-2 top-2 z-10" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-card/80 backdrop-blur-md border border-border/60 text-foreground hover:bg-card transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-lg press-scale">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-xl border-border shadow-2xl">
              <DropdownMenuItem onClick={() => setActiveFile(item)} className="font-medium cursor-pointer">
                <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem className="font-medium cursor-pointer">
                <FolderOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                Assign to Course
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem className="text-red-400 focus:text-red-400 focus:bg-red-500/10 font-medium cursor-pointer">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete File
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Overlay Play Icon */}
        {isVideo && !isFailed && !isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(79,70,229,0.5)] scale-90 group-hover:scale-100 transition-all duration-300 backdrop-blur-sm">
              <PlayCircle className="h-7 w-7 ml-1" />
            </div>
          </div>
        )}

        {/* Duration / Pages Badge */}
        {(item.duration || item.pages) && (
          <div className="absolute bottom-3 right-3 rounded-lg bg-card/80 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-foreground backdrop-blur-md border border-border/60 shadow-lg">
            {item.duration || `${item.pages} pgs`}
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start gap-2 mb-3">
          <h3
            className="font-bold text-sm line-clamp-2 leading-snug text-foreground truncate flex-1 group-hover:text-primary transition-colors"
            title={item.filename}
          >
            {item.filename}
          </h3>
        </div>

        <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/50">
          <span className="font-semibold">{formatBytes(item.size)}</span>
          {isProcessing ? (
            <span className="text-emerald-400 font-bold tracking-wide">Processing...</span>
          ) : isFailed ? (
            <span className="text-red-400 font-bold tracking-wide">Failed</span>
          ) : (
            <span className="font-semibold opacity-70">{item.createdAt}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function MediaGrid() {
  const [media, setMedia] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchData() {
      try {
        // Show courses as media items — avoid per-course video fetch which may 500
        const coursesRes = await apiClient.get('/api/v1/teacher/courses?page=1&page_size=20');
        const raw = coursesRes.data?.items ?? coursesRes.data?.data ?? coursesRes.data ?? [];
        const courses: any[] = Array.isArray(raw) ? raw : [];
        setMedia(courses.map((c: any) => ({
          id: c.id,
          filename: c.title ?? "Untitled Course",
          type: "video" as const,
          size: 0,
          status: c.status === "PUBLISHED" ? "Ready" : "Draft",
          createdAt: c.created_at ? new Date(c.created_at).toLocaleDateString() : "",
          thumbnail: c.thumbnail_url ?? c.cover_image,
          duration: undefined,
          usageCount: c.enrolled_students_count ?? 0,
        })));
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 pb-24">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="card-glass h-64 bg-border/20 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground w-full col-span-full">
        <FolderOpen className="h-16 w-16 mb-4 opacity-50" />
        <p>No media files found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 pb-24">
      {media.map((item) => (
        <MediaCard key={item.id} item={item} />
      ))}
    </div>
  );
}
