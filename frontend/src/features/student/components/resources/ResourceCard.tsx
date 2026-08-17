"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { Resource } from "../../constants/resources.mock";
import { useResourcesStore } from "@/stores/resources.store";
import {
  FileText,
  Video,
  Presentation,
  FileArchive,
  Code2,
  Link as LinkIcon,
  Download,
  Bookmark,
  CheckCircle2,
} from "lucide-react";

interface ResourceCardProps {
  resource: Resource;
}

const TYPE_ICONS: Record<string, any> = {
  pdf: FileText,
  video: Video,
  slides: Presentation,
  zip: FileArchive,
  code: Code2,
  link: LinkIcon,
};

// Tailwind-safe color classes per type
const TYPE_ICON_CLASS: Record<string, string> = {
  pdf: "text-red-500",
  video: "text-purple-500",
  slides: "text-orange-500",
  zip: "text-yellow-500",
  code: "text-blue-500",
  link: "text-emerald-500",
};

const TYPE_BG_CLASS: Record<string, string> = {
  pdf: "bg-red-500/10",
  video: "bg-purple-500/10",
  slides: "bg-orange-500/10",
  zip: "bg-yellow-500/10",
  code: "bg-blue-500/10",
  link: "bg-emerald-500/10",
};

const TYPE_LABELS: Record<string, string> = {
  pdf: "PDF Document",
  video: "Video Recording",
  slides: "Presentation",
  zip: "Archive",
  code: "Source Code",
  link: "External Link",
};

export function ResourceCard({ resource }: ResourceCardProps) {
  const { viewMode, setSelectedResource } = useResourcesStore();
  const date = parseISO(resource.uploadDate);
  const IconComp = TYPE_ICONS[resource.type];

  if (viewMode === "list") {
    return (
      <div
        onClick={() => setSelectedResource(resource)}
        className="flex items-center gap-4 px-3 py-3 rounded-lg border border-transparent hover:bg-card/60 hover:border-border/50 transition-all cursor-pointer hover-lift"
      >
        <div className={`h-10 w-10 shrink-0 rounded-md ${TYPE_BG_CLASS[resource.type]} border border-border/50 flex items-center justify-center`}>
          <IconComp className={`h-5 w-5 ${TYPE_ICON_CLASS[resource.type]}`} />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-foreground truncate">
            {resource.title}
          </h4>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span>{TYPE_LABELS[resource.type]}</span>
            <span>&bull;</span>
            <span className="truncate">{resource.course}</span>
          </div>
        </div>

        <div className="flex flex-col items-end text-xs text-muted-foreground mr-4 shrink-0">
          <span>{format(date, "MMM d, yyyy")}</span>
          {resource.fileSize && <span>{resource.fileSize}</span>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {resource.isDownloaded ? (
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-emerald-500 bg-emerald-500/10"
              title="Downloaded"
            >
              <CheckCircle2 className="h-4 w-4" />
            </div>
          ) : (
            <div className="h-8 w-8 flex items-center justify-center text-muted-foreground">
              <Download className="h-4 w-4" />
            </div>
          )}
          <div
            className={`h-8 w-8 flex items-center justify-center ${
              resource.isBookmarked ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Bookmark
              className="h-4 w-4"
              fill={resource.isBookmarked ? "currentColor" : "none"}
            />
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === "compact") {
    return (
      <div
        onClick={() => setSelectedResource(resource)}
        className="flex items-center gap-3 px-3 py-2 rounded cursor-pointer text-sm border-b border-border/30 hover:bg-card/60 transition-all"
      >
        <div className="shrink-0">
          <IconComp className={`h-5 w-5 ${TYPE_ICON_CLASS[resource.type]}`} />
        </div>
        <div className="flex-1 font-medium text-foreground truncate pr-4">
          {resource.title}
        </div>
        <div className="w-32 shrink-0 text-xs text-muted-foreground truncate">
          {resource.course}
        </div>
        <div className="w-24 shrink-0 text-xs text-muted-foreground">
          {format(date, "MMM d, yyyy")}
        </div>
      </div>
    );
  }

  // Default: Grid View
  return (
    <div
      onClick={() => setSelectedResource(resource)}
      className="card-glass hover-lift overflow-hidden cursor-pointer flex flex-col h-[280px]"
    >
      {/* Thumbnail Area */}
      <div className="h-32 bg-card relative overflow-hidden rounded-t-2xl flex items-center justify-center">
        {resource.thumbnailUrl ? (
          <img
            src={resource.thumbnailUrl}
            alt={resource.title}
            className="w-full h-full object-cover opacity-60"
          />
        ) : (
          <div className="opacity-40">
            <IconComp
              className={`h-16 w-16 ${TYPE_ICON_CLASS[resource.type]}`}
            />
          </div>
        )}

        {/* Type badge */}
        <div className="absolute top-2 left-2 bg-background/80 backdrop-blur rounded px-2 py-1 flex items-center gap-1.5 border border-border/50">
          <IconComp className={`h-3.5 w-3.5 ${TYPE_ICON_CLASS[resource.type]}`} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
            {resource.type}
          </span>
        </div>

        {/* Status badges */}
        <div className="absolute top-2 right-2 flex gap-1">
          {resource.isDownloaded && (
            <div className="bg-emerald-500/90 text-white rounded-full p-1 backdrop-blur">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          )}
          {resource.isBookmarked && (
            <div className="bg-primary/90 text-primary-foreground rounded-full p-1 backdrop-blur">
              <Bookmark className="h-3.5 w-3.5 fill-current" />
            </div>
          )}
        </div>
      </div>

      {/* Info Area */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-foreground text-sm mb-1 line-clamp-2">
          {resource.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-1">{resource.course}</p>

        <div className="mt-auto pt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/30">
          <span>{format(date, "MMM d")}</span>
          <span>{resource.fileSize || "Link"}</span>
        </div>
      </div>
    </div>
  );
}
