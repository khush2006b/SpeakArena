"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Users, ArrowRight, Mic, Briefcase, BookOpen, Loader2 } from "lucide-react";
import { apiClient } from "@/services/api/client";

const ACCENT_SETS = [
  { color: "#3b82f6", bg: "rgba(59,130,246,0.12)", gradient: "linear-gradient(135deg,rgba(59,130,246,0.18),rgba(99,102,241,0.12))" },
  { color: "#10b981", bg: "rgba(16,185,129,0.12)", gradient: "linear-gradient(135deg,rgba(16,185,129,0.18),rgba(6,182,212,0.10))" },
  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", gradient: "linear-gradient(135deg,rgba(245,158,11,0.18),rgba(239,68,68,0.10))" },
  { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", gradient: "linear-gradient(135deg,rgba(139,92,246,0.18),rgba(99,102,241,0.10))" },
  { color: "#06b6d4", bg: "rgba(6,182,212,0.12)", gradient: "linear-gradient(135deg,rgba(6,182,212,0.18),rgba(59,130,246,0.10))" },
  { color: "#ec4899", bg: "rgba(236,72,153,0.12)", gradient: "linear-gradient(135deg,rgba(236,72,153,0.18),rgba(139,92,246,0.10))" },
];
const ICONS = [Mic, Briefcase, BookOpen];

interface DisplayCourse {
  id: string;
  title: string;
  description: string;
  level: string;
  enrolledCount: number;
  price: string;
  accent: typeof ACCENT_SETS[0];
  Icon: typeof Mic;
  badge: string | null;
}

export function CourseShowcaseSection() {
  const [courses, setCourses] = useState<DisplayCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/api/v1/courses/explore", { params: { page: 1, page_size: 6 } })
      .then(({ data }) => {
        const raw = data?.data?.items ?? data?.items ?? data?.data ?? [];
        if (Array.isArray(raw) && raw.length > 0) {
          const mapped: DisplayCourse[] = raw.slice(0, 6).map((c: any, i: number) => ({
            id: String(c.id),
            title: c.title ?? "Untitled Course",
            description: c.description ?? c.short_description ?? "An English fluency course.",
            level: c.level ?? "All Levels",
            enrolledCount: c.total_enrollments ?? c.enrolled_count ?? 0,
            price: c.price != null ? (Number(c.price) === 0 ? "Free" : `₹${Number(c.price).toLocaleString()}`) : "Free",
            accent: ACCENT_SETS[i % ACCENT_SETS.length],
            Icon: ICONS[i % ICONS.length],
            badge: c.status === "published" || c.status === "PUBLISHED" ? "Featured" : null,
          }));
          setCourses(mapped);
        }
      })
      .catch(() => {
        // leave courses empty — show empty state
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="courses" style={{ width: "100%", background: "#080c14", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 1, background: "linear-gradient(90deg,transparent,rgba(99,102,241,0.3),transparent)" }} />

      <div className="w-full px-6 sm:px-12 lg:px-20 py-16 sm:py-20 lg:py-28" style={{ position: "relative", zIndex: 10 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 56, gap: 24, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 560 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 100, padding: "6px 16px", marginBottom: 20 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", display: "inline-block" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Featured Curriculums</span>
            </div>
            <h2 style={{ fontSize: "clamp(28px,3.5vw,46px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.1, margin: "0 0 16px 0" }}>
              Industry-aligned programs
            </h2>
            <p style={{ fontSize: 16, color: "#6b7280", lineHeight: 1.7, margin: 0 }}>
              Designed to take you from foundational concepts to senior-level English fluency and exam excellence.
            </p>
          </div>
          <Link
            href="/courses"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "#818cf8", textDecoration: "none", border: "1px solid rgba(129,140,248,0.3)", borderRadius: 10, padding: "10px 20px", transition: "background 0.15s", whiteSpace: "nowrap" as const }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.1)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
          >
            View all courses <ArrowRight style={{ width: 16, height: 16 }} />
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 280 }}>
            <Loader2 style={{ width: 36, height: 36, color: "#818cf8", animation: "spin 1s linear infinite" }} />
          </div>
        ) : courses.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 24px", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, color: "#6b7280" }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>Courses coming soon</p>
            <p style={{ fontSize: 14 }}>Our first courses will be available shortly. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Link
                key={course.id}
                href="/courses"
                style={{
                  display: "flex", flexDirection: "column",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 20, overflow: "hidden", textDecoration: "none",
                  transition: "border-color 0.2s, transform 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = `${course.accent.color}40`;
                  el.style.transform = "translateY(-6px)";
                  el.style.boxShadow = "0 24px 64px rgba(0,0,0,0.4)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "rgba(255,255,255,0.07)";
                  el.style.transform = "translateY(0)";
                  el.style.boxShadow = "none";
                }}
              >
                {/* Thumbnail area */}
                <div style={{ position: "relative", aspectRatio: "16/9", background: course.accent.gradient, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {course.badge && (
                    <div style={{ position: "absolute", top: 14, left: 14, background: `${course.accent.color}22`, border: `1px solid ${course.accent.color}50`, borderRadius: 100, padding: "4px 12px", fontSize: 11, fontWeight: 700, color: course.accent.color }}>
                      {course.badge}
                    </div>
                  )}
                  <div style={{ padding: 14, borderRadius: "50%", background: course.accent.bg, border: `1px solid ${course.accent.color}30` }}>
                    <course.Icon style={{ width: 32, height: 32, color: course.accent.color }} />
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: "24px 24px 20px 24px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: course.accent.color, background: course.accent.bg, padding: "3px 10px", borderRadius: 100 }}>{course.level}</span>
                  </div>

                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9", lineHeight: 1.3, margin: "0 0 12px 0" }}>
                    {course.title}
                  </h3>

                  <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7, margin: "0 0 auto 0", flex: 1 }}>
                    {course.description}
                  </p>

                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16, marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6b7280" }}>
                      <Users style={{ width: 13, height: 13 }} />
                      {course.enrolledCount.toLocaleString()} enrolled
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{course.price}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
