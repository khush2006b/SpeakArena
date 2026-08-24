"use client";

import React from "react";
import Link from "next/link";
import { Mic2 } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

interface AuthLayoutProps {
  children: React.ReactNode;
  quote?: string;
  author?: string;
}

/* ── Partner brand names (matching SoftQA's wordmark grid) ── */
const PARTNERS = [
  "Google Meet", "Cambridge", "Grammarly", "Pearson",
  "IELTS Band 8+", "Coursera", "TOEFL iBT", "Duolingo",
];

export function AuthLayout({ children, quote, author }: AuthLayoutProps) {
  return (
    /*
     * Outer container: CSS Grid with two equal columns.
     * `grid` + `grid-cols-2` guarantees a hard 50/50 split that
     * cannot be squished by content — no flex, no w-1/2 issues.
     */
    <div className="flex min-h-screen w-full bg-background text-foreground transition-colors duration-200">
      {/* ══════════════════════════════════════════════════
          LEFT COLUMN — Brand + Form
         ══════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-14 py-10 min-h-screen bg-background text-foreground">
        {/* ── Logo row (top-left) ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #4f46e5, #9333ea)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Mic2 style={{ width: 18, height: 18, color: "#fff" }} />
            </div>
            <span className="text-lg font-bold text-foreground tracking-tight">
              SpeakArena
            </span>
          </Link>
          <ThemeToggle />
        </div>

        {/* ── Form — vertically centered in remaining space ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "32px 0" }}>
          <div style={{ width: "100%", maxWidth: 400 }}>
            {children}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="text-xs text-muted-foreground text-center flex-shrink-0">
          © {new Date().getFullYear()} SpeakArena Inc.
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          RIGHT COLUMN — Showcase (matches SoftQA right panel)
          flex-col + justify-between so content is at top
          and partner logos are pinned to bottom
         ══════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex flex-col flex-1 bg-card/60 border-l border-border/60 transition-colors duration-200"
        style={{
          padding: "56px",
          minHeight: "100vh",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle glow */}
        <div style={{ position: "absolute", top: -100, right: -100, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.18) 0%, transparent 70%)", filter: "blur(80px)", pointerEvents: "none" }} />

        {/* ── MIDDLE: Headline + Testimonial — vertically centered ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1 }}>

          {/* Main display headline — bigger font */}
          <h2
            className="text-4xl lg:text-5xl font-bold text-foreground leading-tight tracking-tight mb-11"
          >
            Master Spoken English<br />with Certified Coaches
          </h2>

          {/* Large opening quote mark */}
          <div className="text-6xl leading-none text-muted-foreground/30 mb-4 font-serif select-none">
            &ldquo;
          </div>

          {/* Quote text */}
          <p className="text-lg text-muted-foreground leading-relaxed mb-7">
            {quote || "SpeakArena has completely transformed my speaking confidence. It's reliable, structured, and ensures my fluency improves every single day."}
          </p>

          {/* Author row */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #4f46e5, #9333ea)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
                color: "#fff",
                flexShrink: 0,
                border: "2px solid hsl(var(--border))",
              }}
            >
              {author ? author.charAt(0) : "MC"}
            </div>
            <div>
              <div className="text-base font-semibold text-foreground leading-snug">{author || "Michael Carter"}</div>
              <div className="text-xs text-muted-foreground mt-1">IELTS Band 8.5 Student &amp; Software Engineer</div>
            </div>
          </div>
        </div>

        {/* ── BOTTOM: Partner logos — pinned to bottom with marginTop auto ── */}
        <div style={{ position: "relative", zIndex: 1, marginTop: 48 }}>
          {/* "JOIN 50K+" label + rule */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              JOIN 50K+ LEARNERS
            </span>
            <div style={{ height: 1, flex: 1, background: "rgba(255,255,255,0.1)" }} />
          </div>
          {/* 4 × 2 grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", rowGap: 14, columnGap: 8 }}>
            {PARTNERS.map((name) => (
              <div key={name} style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
