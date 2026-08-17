"use client";

import * as React from "react";
import { UploadCloud, FileText, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBuilderStore } from "@/stores/builder.store";
import { uploadService } from "@/services/upload.service";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: "uploading" | "done" | "error";
  progress: number;
  resourceId?: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResourcesStep() {
  const { nextStep, prevStep, courseId } = useBuilderStore();
  const [files, setFiles] = React.useState<UploadedFile[]>([]);
  const dropRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const uploadFile = async (file: File) => {
    const tempId = `temp-${Date.now()}-${file.name}`;
    setFiles((prev) => [
      ...prev,
      { id: tempId, name: file.name, size: file.size, type: file.type, status: "uploading", progress: 0 },
    ]);

    try {
      const resourceType = file.type === "application/pdf" ? "pdf" : "document";
      const { uploadUrl, resourceId, key } = await uploadService.getUploadUrl({
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        resourceType,
        ...(courseId ? { courseId } : {}),
      });

      await uploadService.uploadToR2(uploadUrl, file, {
        resourceId,
        onProgress: ({ progress }) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === tempId ? { ...f, progress } : f))
          );
        },
      });

      await uploadService.confirmUpload({ resourceId, key });

      setFiles((prev) =>
        prev.map((f) =>
          f.id === tempId ? { ...f, id: resourceId, status: "done", progress: 100, resourceId } : f
        )
      );
      toast.success(`"${file.name}" uploaded successfully.`);
    } catch (err: any) {
      setFiles((prev) =>
        prev.map((f) => (f.id === tempId ? { ...f, status: "error", progress: 0 } : f))
      );
      toast.error(`Failed to upload "${file.name}": ${err?.message}`);
    }
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    if (!courseId) {
      toast.error("Please complete Step 1 first to create a course.");
      return;
    }
    Array.from(fileList).forEach(uploadFile);
  };

  const handleRemove = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Course Resources</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload PDFs, cheat sheets, or documents available to all enrolled students.
        </p>
      </div>

      {!courseId && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Go back to Step 1 to create the course before uploading resources.
        </div>
      )}

      {/* Drop Zone */}
      <div
        ref={dropRef}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => courseId && inputRef.current?.click()}
        className={cn(
          "w-full rounded-xl border-2 border-dashed p-10 flex flex-col items-center justify-center text-center transition-all",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border/60 bg-secondary/20 hover:bg-secondary/40 hover:border-primary/30",
          courseId ? "cursor-pointer" : "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.zip,.ppt,.pptx,.xls,.xlsx"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <UploadCloud className="h-6 w-6 text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground">
          {isDragging ? "Drop files here..." : "Click to upload or drag and drop"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, PPTX, ZIP up to 50 MB each</p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Attached Files ({files.length})
          </h3>

          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 rounded-md border border-border bg-card shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex h-9 w-9 items-center justify-center rounded bg-orange-500/10 shrink-0">
                  <FileText className="h-4 w-4 text-orange-500" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground truncate">{file.name}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                    {file.status === "uploading" && (
                      <>
                        <span className="text-xs text-muted-foreground">•</span>
                        <div className="flex-1 bg-border rounded-full h-1.5 max-w-[120px]">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-primary font-medium">{file.progress}%</span>
                      </>
                    )}
                    {file.status === "done" && (
                      <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Uploaded
                      </span>
                    )}
                    {file.status === "error" && (
                      <span className="text-xs text-destructive font-medium flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Failed
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 press-scale"
                onClick={() => handleRemove(file.id)}
                disabled={file.status === "uploading"}
              >
                {file.status === "uploading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="pt-6 border-t border-border flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          ← Back to Curriculum
        </Button>
        <Button onClick={nextStep} className="shadow-sm shadow-primary/20 px-8 press-scale">
          Continue to Live Classes →
        </Button>
      </div>
    </div>
  );
}
