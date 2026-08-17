"use client";

import * as React from "react";
import { Image as ImageIcon, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBuilderStore } from "@/stores/builder.store";

export function InformationStep() {
  const {
    courseTitle, setCourseTitle,
    subtitle, setSubtitle,
    description, setDescription,
    thumbnailUrl, setThumbnailUrl,
    createCourse, isCreating, error, clearError,
  } = useBuilderStore();

  const [thumbnailPreview, setThumbnailPreview] = React.useState<string | null>(thumbnailUrl);
  const thumbnailInputRef = React.useRef<HTMLInputElement>(null);

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setThumbnailPreview(objectUrl);
    // In production you'd upload to R2 here and setThumbnailUrl(uploadedUrl)
    setThumbnailUrl(objectUrl);
  };

  const handleContinue = async () => {
    clearError();
    await createCourse();
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Course Information</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Give your course a compelling title and description.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            Course Title <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={courseTitle}
            onChange={(e) => setCourseTitle(e.target.value)}
            placeholder="e.g., Spoken English & Accent Reduction Masterclass"
            className="w-full h-11 rounded-md border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-all font-medium"
          />
        </div>

        {/* Subtitle */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Subtitle</label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="A short, catchy description..."
            className="w-full h-11 rounded-md border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-all"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Full Description</label>
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What will students learn? What topics are covered?"
            className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-all resize-none"
          />
        </div>

        {/* Thumbnail Upload */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Course Thumbnail</label>
          <input
            ref={thumbnailInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleThumbnailChange}
          />
          <div
            onClick={() => thumbnailInputRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-border/60 bg-secondary/20 overflow-hidden transition-colors hover:bg-secondary/40 hover:border-primary/30 cursor-pointer"
          >
            {thumbnailPreview ? (
              <div className="relative">
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail preview"
                  className="w-full h-48 object-cover"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <p className="text-white text-sm font-semibold">Click to change</p>
                </div>
              </div>
            ) : (
              <div className="p-10 flex flex-col items-center justify-center text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <ImageIcon className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground mt-1">SVG, PNG, JPG or GIF (max. 800×400px)</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-border flex justify-end">
        <Button
          onClick={handleContinue}
          disabled={isCreating || !courseTitle.trim()}
          className="shadow-sm shadow-primary/20 px-8 press-scale min-w-[180px]"
        >
          {isCreating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating Course...
            </>
          ) : (
            "Continue to Curriculum →"
          )}
        </Button>
      </div>
    </div>
  );
}
