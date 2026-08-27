"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Rocket, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBuilderStore } from "@/stores/builder.store";

export function BuilderHeader() {
  const router = useRouter();
  const {
    courseId,
    courseTitle,
    isPublishing,
    publishCourse,
  } = useBuilderStore();

  const handlePublish = async () => {
    if (!courseTitle.trim()) return;
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
                background: "rgba(124,58,237,0.15)",
                color: "hsl(var(--primary))",
                border: "1px solid rgba(124,58,237,0.25)",
                fontSize: "10px",
                textTransform: "uppercase",
                padding: "0 6px",
                borderRadius: "10px",
                flexShrink: 0,
              }}
            >
              {courseId ? "Editing Course" : "New Course"}
            </Badge>
          </div>
          <span style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))", marginTop: "2px" }}>
            {courseId ? "Saving changes to existing course" : "Will be saved to database when published"}
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <Button
          onClick={handlePublish}
          disabled={!courseTitle.trim() || isPublishing}
          style={{
            height: "36px",
            background: "hsl(var(--primary))",
            color: "#fff",
            borderRadius: "10px",
            fontWeight: 700,
            border: "none",
            transition: "all 0.2s",
            opacity: (!courseTitle.trim() || isPublishing) ? 0.6 : 1,
          }}
        >
          {isPublishing ? (
            <Loader2 style={{ height: "14px", width: "14px", marginRight: "8px", animation: "spin 1s linear infinite" }} />
          ) : (
            <Rocket style={{ height: "16px", width: "16px", marginRight: "8px" }} />
          )}
          {courseId ? "Save Changes" : "Publish Course"}
        </Button>
      </div>
    </header>
  );
}
