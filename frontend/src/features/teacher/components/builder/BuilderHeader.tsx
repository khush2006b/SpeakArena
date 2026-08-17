"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Save, Eye, Rocket, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBuilderStore } from "@/stores/builder.store";

export function BuilderHeader() {
  const router = useRouter();
  const {
    courseTitle,
    isDirty,
    isSaving,
    isPublishing,
    lastSaved,
    saveDraft,
    publishCourse,
    courseId,
  } = useBuilderStore();

  const handleSave = async () => {
    await saveDraft();
  };

  const handlePublish = async () => {
    if (!courseId) return;
    const ok = await publishCourse();
    if (ok) {
      router.push("/teacher/courses");
    }
  };

  return (
    <header
      style={{
        height: "64px",
        flexShrink: 0,
        borderBottom: "1px solid hsl(var(--border))",
        background: "hsl(var(--background))",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        zIndex: 10,
        position: "relative",
      }}
    >
      {/* Left: Back + Title */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/teacher/courses")}
          title="Exit Builder"
          style={{
            background: "hsl(var(--border))",
            border: "1px solid hsl(var(--border))",
            color: "hsl(var(--muted-foreground))",
            borderRadius: "10px",
          }}
        >
          <ArrowLeft style={{ height: "20px", width: "20px" }} />
        </Button>

        <div style={{ height: "24px", width: "1px", background: "hsl(var(--border))" }} />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1
              style={{
                fontSize: "14px",
                fontWeight: 800,
                color: "hsl(var(--foreground))",
                display: "-webkit-box",
                WebkitLineClamp: 1,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                margin: 0,
                maxWidth: "260px",
              }}
            >
              {courseTitle || "Untitled Course"}
            </h1>
            <Badge
              variant="outline"
              style={{
                background: "rgba(245,158,11,0.15)",
                color: "#f59e0b",
                border: "1px solid rgba(245,158,11,0.25)",
                fontSize: "10px",
                textTransform: "uppercase",
                padding: "0 6px",
                borderRadius: "10px",
                flexShrink: 0,
              }}
            >
              Draft
            </Badge>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
            {isSaving ? (
              <>
                <Loader2 style={{ height: "12px", width: "12px", color: "hsl(var(--muted-foreground))", animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))" }}>Saving...</span>
              </>
            ) : isDirty ? (
              <>
                <div style={{ height: "6px", width: "6px", borderRadius: "50%", background: "#f59e0b" }} />
                <span style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))" }}>Unsaved changes</span>
              </>
            ) : (
              <>
                <Save style={{ height: "12px", width: "12px", color: "hsl(var(--muted-foreground))" }} />
                <span style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))" }}>
                  Saved {lastSaved ? `at ${lastSaved}` : "just now"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <Button
          variant="outline"
          onClick={handleSave}
          disabled={(!isDirty && !!courseId) || isSaving}
          style={{
            height: "36px",
            background: "hsl(var(--border))",
            border: "1px solid hsl(var(--border))",
            color: "hsl(var(--muted-foreground))",
            borderRadius: "10px",
            transition: "all 0.2s",
            opacity: ((!isDirty && !!courseId) || isSaving) ? 0.5 : 1,
          }}
        >
          {isSaving ? (
            <Loader2 style={{ height: "14px", width: "14px", marginRight: "8px", animation: "spin 1s linear infinite" }} />
          ) : (
            <Save style={{ height: "16px", width: "16px", marginRight: "8px" }} />
          )}
          Save Draft
        </Button>

        <Button
          variant="outline"
          disabled={!courseId}
          onClick={() => courseId && window.open(`/teacher/courses/${courseId}/preview`, "_blank")}
          style={{
            height: "36px",
            background: "hsl(var(--border))",
            border: "1px solid hsl(var(--border))",
            color: "hsl(var(--muted-foreground))",
            borderRadius: "10px",
            transition: "all 0.2s",
            opacity: !courseId ? 0.5 : 1,
          }}
        >
          <Eye style={{ height: "16px", width: "16px", marginRight: "8px" }} />
          Preview
        </Button>

        <Button
          onClick={handlePublish}
          disabled={!courseId || isPublishing}
          style={{
            height: "36px",
            background: "hsl(var(--primary))",
            color: "#fff",
            borderRadius: "10px",
            fontWeight: 700,
            border: "none",
            transition: "all 0.2s",
            opacity: (!courseId || isPublishing) ? 0.6 : 1,
          }}
        >
          {isPublishing ? (
            <Loader2 style={{ height: "14px", width: "14px", marginRight: "8px", animation: "spin 1s linear infinite" }} />
          ) : (
            <Rocket style={{ height: "16px", width: "16px", marginRight: "8px" }} />
          )}
          Publish
        </Button>
      </div>
    </header>
  );
}
