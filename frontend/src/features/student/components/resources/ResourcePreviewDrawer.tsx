"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useResourcesStore } from "@/stores/resources.store";
import {
  Download,
  Bookmark,
  Share2,
  ExternalLink,
  FileText,
  Video,
  Presentation,
  FileArchive,
  Code2,
  Link as LinkIcon,
  Calendar,
  HardDrive,
  User,
  Eye,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const TYPE_ICON_JSX: Record<string, React.ReactNode> = {
  pdf: <FileText className="h-8 w-8 text-red-500" />,
  video: <Video className="h-8 w-8 text-purple-500" />,
  slides: <Presentation className="h-8 w-8 text-orange-500" />,
  zip: <FileArchive className="h-8 w-8 text-yellow-500" />,
  code: <Code2 className="h-8 w-8 text-blue-500" />,
  link: <LinkIcon className="h-8 w-8 text-emerald-500" />,
};

export function ResourcePreviewDrawer() {
  const { selectedResource, setSelectedResource } = useResourcesStore();

  if (!selectedResource) return null;

  return (
    <Sheet
      open={!!selectedResource}
      onOpenChange={(open) => !open && setSelectedResource(null)}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-background border-l border-border/50 flex flex-col p-0"
      >
        {/* Header */}
        <div className="p-6 border-b border-border/50 bg-card/60 backdrop-blur-xl shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div className="h-16 w-16 rounded-xl bg-card border border-border flex items-center justify-center">
              {TYPE_ICON_JSX[selectedResource.type]}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className={`btn-ghost ${
                  selectedResource.isBookmarked
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <Bookmark
                  className="h-5 w-5"
                  fill={selectedResource.isBookmarked ? "currentColor" : "none"}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="btn-ghost text-muted-foreground"
              >
                <Share2 className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <SheetHeader className="text-left">
            <SheetTitle className="text-xl font-extrabold text-foreground leading-tight">
              {selectedResource.title}
            </SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground mt-1">
              {selectedResource.course}
            </SheetDescription>
          </SheetHeader>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 flex flex-col gap-6">

            {/* Description */}
            <div>
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                Description
              </h4>
              <p className="text-sm text-foreground leading-relaxed">
                {selectedResource.description}
              </p>
            </div>

            <div className="h-px bg-border/50 w-full" />

            {/* Metadata Grid */}
            <div>
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                Information
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <MetaItem
                  icon={<Calendar className="h-3 w-3 mr-1" />}
                  label="Uploaded"
                  value={format(parseISO(selectedResource.uploadDate), "MMM d, yyyy")}
                />
                <MetaItem
                  icon={<HardDrive className="h-3 w-3 mr-1" />}
                  label="Size"
                  value={selectedResource.fileSize || "External"}
                />
                <MetaItem
                  icon={<User className="h-3 w-3 mr-1" />}
                  label="Added By"
                  value={selectedResource.teacher}
                />
                <MetaItem
                  icon={<Eye className="h-3 w-3 mr-1" />}
                  label="Downloads"
                  value={selectedResource.downloads.toLocaleString()}
                />
              </div>
            </div>

            {selectedResource.module && (
              <>
                <div className="h-px bg-border/50 w-full" />
                <div>
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                    Related Content
                  </h4>
                  <div className="p-3 bg-card/60 rounded-xl border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Module</p>
                    <p className="text-sm font-medium text-foreground">
                      {selectedResource.module}
                    </p>
                    <Button
                      variant="link"
                      className="h-auto p-0 text-xs text-primary mt-2"
                    >
                      Go to Module &rarr;
                    </Button>
                  </div>
                </div>
              </>
            )}

          </div>
        </ScrollArea>

        {/* Footer Action */}
        <div className="p-6 border-t border-border/50 bg-background shrink-0">
          <Button
            className={`btn-primary w-full h-12 text-base font-bold press-scale ${
              selectedResource.type === "link"
                ? "bg-card border border-border text-foreground hover:bg-secondary/50"
                : ""
            }`}
          >
            {selectedResource.type === "link" ? (
              <>
                <ExternalLink className="mr-2 h-5 w-5" /> Open Link
              </>
            ) : selectedResource.isDownloaded ? (
              <>
                <FileText className="mr-2 h-5 w-5" /> Open File
              </>
            ) : (
              <>
                <Download className="mr-2 h-5 w-5" /> Download File
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground flex items-center">
        {icon} {label}
      </span>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
