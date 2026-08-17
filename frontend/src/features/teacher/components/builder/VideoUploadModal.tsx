"use client";

import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileUploadDropzone } from "@/components/ui/FileUploadDropzone";
import { Progress } from "@/components/ui/progress";
import { XCircle, FileVideo, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/services/api/client";

interface VideoUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  onUploadSuccess: (data: any) => void;
}

export function VideoUploadModal({ open, onOpenChange, courseId, onUploadSuccess }: VideoUploadModalProps) {
  const [title, setTitle] = useState("");
  const [section, setSection] = useState("Module 1");
  const [isUploadingPhase, setIsUploadingPhase] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "error" | "success">("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleClose = () => {
    if (status === "uploading") {
      const confirmClose = window.confirm("Upload is currently in progress. Cancel upload?");
      if (!confirmClose) return;
      abortControllerRef.current?.abort();
    }
    setTitle("");
    setFile(null);
    setProgress(0);
    setStatus("idle");
    setErrorMsg(null);
    setIsUploadingPhase(false);
    onOpenChange(false);
  };

  const handleFileSelect = async (selectedFile: File) => {
    if (!title.trim()) {
      toast.error("Please enter a lesson title first.");
      return;
    }

    setFile(selectedFile);
    setIsUploadingPhase(true);
    setStatus("uploading");
    setProgress(30);
    setErrorMsg(null);

    abortControllerRef.current = new AbortController();

    try {
      // Step 1: Create Video record (JSON)
      const { data: createRes } = await apiClient.post(
        `/api/v1/teacher/courses/${courseId}/videos`,
        {
          title: title.trim(),
          section: section.trim() || "Module 1",
          sort_order: 1,
          visibility: "private",
          is_free_preview: false,
          mime_type: selectedFile.type || "video/mp4",
        }
      );

      const videoId = createRes?.data?.video?.id ?? createRes?.video?.id;
      const uploadUrl = createRes?.data?.upload_url ?? createRes?.upload_url;

      // Step 2: Direct R2 PUT upload
      if (uploadUrl) {
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": selectedFile.type || "video/mp4" },
          body: selectedFile,
        });
        if (!putRes.ok) throw new Error(`Storage upload failed (${putRes.status})`);
      }

      // Step 3: Confirm video upload
      if (videoId) {
        await apiClient.post(
          `/api/v1/teacher/courses/${courseId}/videos/${videoId}/confirm`,
          {
            file_size_bytes: selectedFile.size,
            duration_seconds: 0,
          }
        );
      }

      setProgress(100);
      setStatus("success");
      toast.success("Video uploaded successfully!");
      onUploadSuccess(createRes?.data ?? createRes);

      setTimeout(() => {
        handleClose();
      }, 1200);

    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d: any) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(" | ")
        : detail ?? err?.message ?? "Upload failed. Please try again.";
      const errorString = typeof msg === "string" ? msg : JSON.stringify(msg);
      setErrorMsg(errorString);
      setStatus("error");
      toast.error(errorString);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent
        style={{
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "18px",
          color: "hsl(var(--foreground))",
          maxWidth: "500px",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "hsl(var(--foreground))", fontWeight: 800 }}>Upload Video Lesson</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Upload a video for your course curriculum. High-resolution MP4 or WebM files up to 5GB are recommended.
          </DialogDescription>
        </DialogHeader>

        {!isUploadingPhase ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "16px 0" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Label htmlFor="title" style={{ color: "hsl(var(--muted-foreground))", fontSize: "11px", textTransform: "uppercase", fontWeight: 700 }}>
                Lesson Title
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Introduction to System Design"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "10px",
                  color: "hsl(var(--foreground))",
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Label htmlFor="section" style={{ color: "hsl(var(--muted-foreground))", fontSize: "11px", textTransform: "uppercase", fontWeight: 700 }}>
                Module / Section
              </Label>
              <Input
                id="section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="e.g. Module 1"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "10px",
                  color: "hsl(var(--foreground))",
                }}
              />
            </div>

            <div style={{ paddingTop: "8px" }}>
              <Label style={{ display: "block", marginBottom: "12px", color: "hsl(var(--muted-foreground))", fontSize: "11px", textTransform: "uppercase", fontWeight: 700 }}>
                Video File
              </Label>
              <FileUploadDropzone
                onFileSelect={handleFileSelect}
                accept={{
                  "video/mp4": [".mp4"],
                  "video/webm": [".webm"],
                  "video/quicktime": [".mov"],
                }}
                maxSize={5 * 1024 * 1024 * 1024} // 5GB limit
                title="Click or drag video to upload"
                description="Supports MP4, WebM, MOV up to 5GB."
              />
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "24px 0" }}>
            {/* File Info */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "16px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid hsl(var(--border))",
              }}
            >
              <div
                style={{
                  height: "48px",
                  width: "48px",
                  borderRadius: "10px",
                  background: "rgba(124,58,237,0.12)",
                  color: "hsl(var(--primary))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <FileVideo style={{ height: "24px", width: "24px" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "hsl(var(--foreground))",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    margin: 0,
                  }}
                >
                  {file?.name || "Video File"}
                </h4>
                <div style={{ display: "flex", alignItems: "center", fontSize: "12px", color: "hsl(var(--muted-foreground))", marginTop: "4px", gap: "8px" }}>
                  <span>{file?.size ? (file.size / (1024 * 1024)).toFixed(2) : "0"} MB</span>
                  <span>•</span>
                  <span style={{ textTransform: "capitalize" }}>{status}</span>
                </div>
              </div>

              {/* Status Icon */}
              {status === "success" && <CheckCircle2 style={{ height: "24px", width: "24px", color: "#10b981" }} />}
              {status === "error" && <AlertCircle style={{ height: "24px", width: "24px", color: "#ef4444" }} />}
            </div>

            {/* Progress Bar */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: 700 }}>
                <span className="text-foreground">Upload Progress</span>
                <span style={{ color: status === "error" ? "#ef4444" : "hsl(var(--primary))" }}>{progress}%</span>
              </div>
              <Progress
                value={progress}
                style={{
                  height: "8px",
                  background: status === "error" ? "rgba(239,68,68,0.2)" : status === "success" ? "rgba(16,185,129,0.2)" : "hsl(var(--border))",
                }}
                className={status === "error" ? "[&>div]:bg-destructive" : status === "success" ? "[&>div]:bg-emerald-500" : "[&>div]:bg-purple-500"}
              />
            </div>

            {/* Controls */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", paddingTop: "8px" }}>
              {status === "uploading" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  style={{
                    width: "128px",
                    background: "rgba(239,68,68,0.15)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "#ef4444",
                    borderRadius: "10px",
                  }}
                >
                  <XCircle style={{ height: "16px", width: "16px", marginRight: "8px" }} />
                  Cancel
                </Button>
              )}
            </div>

            {errorMsg && (
              <div
                style={{
                  padding: "12px",
                  fontSize: "14px",
                  color: "#ef4444",
                  background: "rgba(239,68,68,0.15)",
                  borderRadius: "10px",
                  border: "1px solid rgba(239,68,68,0.25)",
                }}
              >
                {errorMsg}
              </div>
            )}
          </div>
        )}

        <DialogFooter style={{ display: isUploadingPhase ? "none" : "flex" }}>
          <Button
            variant="ghost"
            onClick={handleClose}
            style={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              color: "hsl(var(--muted-foreground))",
              borderRadius: "10px",
            }}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
