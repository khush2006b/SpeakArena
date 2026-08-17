"use client";

import React from "react";
import { UploadStatus } from "@/hooks/useMultipartUpload";
import { FileIcon, Play, Pause, XCircle, CheckCircle2 } from "lucide-react";
import { Button } from "./button";
import { Progress } from "./progress";
import { cn } from "@/lib/utils";

interface UploadProgressCardProps {
  file: File | null;
  status: UploadStatus;
  progress: number;
  error: Error | null;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

export function UploadProgressCard({
  file,
  status,
  progress,
  error,
  onPause,
  onResume,
  onCancel,
}: UploadProgressCardProps) {
  if (!file || status === "idle") return null;

  const isUploading = status === "uploading";
  const isPaused = status === "paused";
  const isError = status === "error";
  const isSuccess = status === "success";

  const getStatusText = () => {
    if (isError) return "Upload failed";
    if (isSuccess) return "Upload complete";
    if (isPaused) return "Paused";
    return `Uploading... ${progress}%`;
  };

  const getStatusColor = () => {
    if (isError) return "text-destructive";
    if (isSuccess) return "text-emerald-500";
    if (isPaused) return "text-amber-500";
    return "text-primary";
  };

  return (
    <div className="w-full p-4 rounded-xl border border-border bg-card/50 backdrop-blur-sm shadow-sm transition-all">
      <div className="flex items-center gap-4">
        
        {/* File Icon / Thumbnail Placeholder */}
        <div className="h-12 w-12 shrink-0 rounded-lg bg-secondary flex items-center justify-center">
          {file.type.startsWith("video/") ? (
            <Play className="h-6 w-6 text-muted-foreground opacity-50" />
          ) : (
            <FileIcon className="h-6 w-6 text-muted-foreground opacity-50" />
          )}
        </div>

        {/* Info & Progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-foreground truncate mr-4">
              {file.name}
            </span>
            <span className={cn("text-xs font-medium whitespace-nowrap", getStatusColor())}>
              {getStatusText()}
            </span>
          </div>
          
          <Progress 
            value={progress} 
            className={cn(
              "h-1.5 w-full bg-secondary",
              isError && "bg-destructive/20 *:bg-destructive",
              isSuccess && "bg-emerald-500/20 *:bg-emerald-500",
              isPaused && "bg-amber-500/20 *:bg-amber-500"
            )} 
          />
          
          <div className="flex justify-between items-center mt-1.5 text-[10px] text-muted-foreground">
            <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
            {error && <span className="text-destructive truncate max-w-[200px]">{error.message}</span>}
          </div>
        </div>

        {/* Actions */}
        {!isSuccess && (
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {(isUploading || isPaused) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={isUploading ? onPause : onResume}
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
                title={isUploading ? "Pause" : "Resume"}
              >
                {isUploading ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Cancel Upload"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        {isSuccess && (
          <div className="flex items-center justify-center shrink-0 ml-2 h-8 w-8">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
        )}

      </div>
    </div>
  );
}
