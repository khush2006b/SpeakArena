"use client";

import React, { useCallback, useState } from "react";
import { useDropzone, DropzoneOptions } from "react-dropzone";
import { UploadCloud, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadDropzoneProps extends Omit<DropzoneOptions, "onDrop"> {
  onFileSelect: (file: File) => void;
  accept?: Record<string, string[]>;
  maxSize?: number;
  title?: string;
  description?: string;
  className?: string;
}

export function FileUploadDropzone({
  onFileSelect,
  accept,
  maxSize,
  title = "Click or drag file to this area to upload",
  description = "Support for a single or bulk upload.",
  className,
  ...props
}: FileUploadDropzoneProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: any[]) => {
      setError(null);
      
      if (fileRejections.length > 0) {
        const rejection = fileRejections[0];
        if (rejection.errors[0]?.code === "file-too-large") {
          setError(`File is larger than ${(maxSize || 0) / (1024 * 1024)}MB limit.`);
        } else if (rejection.errors[0]?.code === "file-invalid-type") {
          setError("File type not supported.");
        } else {
          setError(rejection.errors[0]?.message || "Invalid file.");
        }
        return;
      }

      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect, maxSize]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    ...(accept ? { accept } : {}),
    ...(maxSize ? { maxSize } : {}),
    multiple: false,
    ...props,
  });

  return (
    <div className={cn("w-full", className)}>
      <div
        {...getRootProps({ role: "button", "aria-label": "File Upload Dropzone", tabIndex: 0 })}
        className={cn(
          "relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200",
          isDragActive ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/20",
          isDragReject ? "border-destructive bg-destructive/5" : "",
          error ? "border-destructive bg-destructive/5" : ""
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
          <div className={cn(
            "p-4 rounded-full mb-4 transition-colors",
            isDragActive ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground",
            error || isDragReject ? "bg-destructive/20 text-destructive" : ""
          )}>
            {error || isDragReject ? (
              <AlertCircle className="w-8 h-8" />
            ) : (
              <UploadCloud className="w-8 h-8" />
            )}
          </div>
          
          <p className="mb-2 text-sm font-semibold text-foreground">
            {error ? (
              <span className="text-destructive">{error}</span>
            ) : isDragActive ? (
              "Drop the file here..."
            ) : (
              title
            )}
          </p>
          
          {!error && (
            <p className="text-xs text-muted-foreground max-w-xs">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
