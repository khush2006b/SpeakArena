"use client";

import * as React from "react";
import { MoreHorizontal, Eye, Trash2, FolderOpen, Video, FileText, Image as ImageIcon } from "lucide-react";
import { apiClient } from "@/services/api/client";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useMediaStore } from "@/stores/media.store";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

interface MediaListProps {
  videos?: any[];
}

export function MediaList({ videos }: MediaListProps = {}) {
  const { setActiveFile } = useMediaStore();
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set());
  const [fetchedVideos, setFetchedVideos] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(!videos);

  React.useEffect(() => {
    if (videos) {
      setFetchedVideos(videos);
      setIsLoading(false);
      return;
    }

    async function fetchData() {
      try {
        // Fetch courses list — avoid per-course /videos endpoint which may return 500
        const coursesRes = await apiClient.get("/api/v1/teacher/courses?page=1&page_size=20");
        const raw = coursesRes.data?.items ?? coursesRes.data?.data ?? coursesRes.data ?? [];
        const courses: any[] = Array.isArray(raw) ? raw : [];
        setFetchedVideos(
          courses.map((c: any) => ({
            id: c.id,
            filename: c.title ?? "Untitled Course",
            type: "video",
            size: 0,
            status: c.status === "PUBLISHED" ? "Ready" : "Draft",
            createdAt: c.created_at ? new Date(c.created_at).toLocaleDateString() : "",
            thumbnail: c.thumbnail_url ?? c.cover_image,
            duration: undefined,
            usageCount: c.enrolled_students_count ?? 0,
          }))
        );
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [videos]);

  const displayData = videos ?? fetchedVideos;

  const toggleAll = () => {
    if (selectedRows.size === displayData.length && displayData.length > 0) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(displayData.map((c) => c.id)));
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading files...</div>;
  }

  if (displayData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <FolderOpen className="h-16 w-16 mb-4 opacity-50" />
        <p>No media files found.</p>
      </div>
    );
  }

  return (
    <div className="card-glass animate-fade-up mb-24 relative overflow-hidden">
      <div className="overflow-x-auto rounded-2xl">
        <table className="table-glass">
          <thead>
            <tr>
              <th className="w-10">
                <Checkbox
                  checked={selectedRows.size === displayData.length && displayData.length > 0}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                  className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
              </th>
              <th>File Name</th>
              <th className="hidden md:table-cell">Size</th>
              <th>Status</th>
              <th className="hidden lg:table-cell">Usage</th>
              <th className="hidden sm:table-cell">Uploaded</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayData.map((item) => {
              const isSelected = selectedRows.has(item.id);
              const isVideo = item.type === "video";
              const isPDF = item.type === "pdf";

              return (
                <tr
                  key={item.id}
                  className={cn(
                    "cursor-pointer group",
                    isSelected ? "bg-primary/5 hover:bg-primary/10" : ""
                  )}
                  onClick={() => setActiveFile(item)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        const next = new Set(selectedRows);
                        if (checked) next.add(item.id);
                        else next.delete(item.id);
                        setSelectedRows(next);
                      }}
                      aria-label={`Select ${item.filename}`}
                      className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                  </td>
                  <td>
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/50 shrink-0 transition-transform group-hover:scale-105">
                        {isVideo && <Video className="h-5 w-5 text-blue-400" />}
                        {isPDF && <FileText className="h-5 w-5 text-orange-400" />}
                        {!isVideo && !isPDF && <ImageIcon className="h-5 w-5 text-emerald-400" />}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-bold tracking-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {item.filename}
                        </span>
                        {item.duration && (
                          <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/70 hidden sm:block">
                            {item.duration}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="text-muted-foreground text-xs font-semibold hidden md:table-cell">
                    {formatBytes(item.size)}
                  </td>
                  <td>
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-bold tracking-widest text-[9px] uppercase px-2 py-0.5",
                        item.status === "Ready"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : item.status === "Processing"
                          ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                          : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      )}
                    >
                      {item.status}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground text-xs font-semibold hidden lg:table-cell">
                    {item.usageCount} enrolled
                  </td>
                  <td className="text-muted-foreground text-[11px] font-semibold hidden sm:table-cell">
                    {item.createdAt}
                  </td>
                  <td className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors press-scale"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
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
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bulk Actions Bar */}
      {selectedRows.size > 0 && (
        <div className="absolute bottom-0 inset-x-0 bg-primary/15 backdrop-blur-md border-t border-primary/30 px-6 py-4 flex items-center justify-between animate-fade-up">
          <span className="text-sm font-extrabold tracking-wide text-primary">
            {selectedRows.size} file{selectedRows.size > 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="bg-card/80 border-border hover:bg-card font-bold tracking-wider text-xs press-scale"
            >
              Move to Folder
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="font-bold tracking-wider text-xs press-scale"
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
