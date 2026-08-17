"use client";

import React from "react";
import {
  Video, MonitorPlay, BookOpen, UserCheck,
  CreditCard, Bell, MessageSquare, Smartphone,
} from "lucide-react";

const FEATURES = [
  {
    title: "Professional Live Classes",
    description: "Seamless Google Meet integration with HD video, screen sharing, and interactive whiteboard.",
    icon: Video,
    accent: "#3b82f6",
    accentBg: "rgba(59,130,246,0.12)",
  },
  {
    title: "Recorded Lectures",
    description: "Missed a class? Access high-quality recordings instantly with custom playback & PiP mode.",
    icon: MonitorPlay,
    accent: "#10b981",
    accentBg: "rgba(16,185,129,0.12)",
  },
  {
    title: "Study Materials",
    description: "Downloadable PDFs, worksheets, and speech audio guides curated by certified English linguists.",
    icon: BookOpen,
    accent: "#f59e0b",
    accentBg: "rgba(245,158,11,0.12)",
  },
  {
    title: "Attendance Tracking",
    description: "Automated logging for live sessions to keep you accountable and your progress on track.",
    icon: UserCheck,
    accent: "#a855f7",
    accentBg: "rgba(168,85,247,0.12)",
  },
  {
    title: "Secure Payments",
    description: "Bank-grade encryption powered by Stripe and Razorpay for seamless global transactions.",
    icon: CreditCard,
    accent: "#f43f5e",
    accentBg: "rgba(244,63,94,0.12)",
  },
  {
    title: "Smart Announcements",
    description: "Real-time push notifications for new assignments, class schedules, and instructor updates.",
    icon: Bell,
    accent: "#06b6d4",
    accentBg: "rgba(6,182,212,0.12)",
  },
  {
    title: "Real-Time Community Chat",
    description: "WebSocket-powered channels to discuss, collaborate, and get help from peers 24/7.",
    icon: MessageSquare,
    accent: "#818cf8",
    accentBg: "rgba(129,140,248,0.12)",
  },
  {
    title: "Cross-Device Learning",
    description: "Fully responsive — feels native on mobile, tablet, and desktop. Learn anywhere, anytime.",
    icon: Smartphone,
    accent: "#fb923c",
    accentBg: "rgba(251,146,60,0.12)",
  },
];

export function FeaturesSection() {
  return (
    <section style={{ width: "100%", background: "#080c14", position: "relative", overflow: "hidden" }}>
      {/* Top glow */}
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "70%", height: 1, background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.4), transparent)" }} />
      <div style={{ position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)", width: 600, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div className="w-full px-6 sm:px-12 lg:px-20" style={{ paddingTop: 96, paddingBottom: 100, position: "relative", zIndex: 10 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 100, padding: "6px 16px", marginBottom: 20 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", display: "inline-block" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Platform Features</span>
          </div>
          <h2 style={{ fontSize: "clamp(28px, 3.5vw, 48px)", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.03em", lineHeight: 1.1, margin: "0 0 18px 0" }}>
            Everything you need to succeed
          </h2>
          <p style={{ fontSize: 17, color: "#6b7280", lineHeight: 1.7, maxWidth: 560, margin: "0 auto" }}>
            A complete learning ecosystem that removes friction — so you can focus purely on mastering spoken English.
          </p>
        </div>

        {/* 4-col grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 18,
                padding: "28px 24px",
                transition: "border-color 0.2s, transform 0.2s, background 0.2s",
                cursor: "default",
                position: "relative",
                overflow: "hidden",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = `${f.accent}40`;
                el.style.background = "rgba(255,255,255,0.055)";
                el.style.transform = "translateY(-4px)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "rgba(255,255,255,0.07)";
                el.style.background = "rgba(255,255,255,0.03)";
                el.style.transform = "translateY(0)";
              }}
            >
              {/* Corner glow on hover */}
              <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: `radial-gradient(circle at top right, ${f.accent}15, transparent 70%)`, pointerEvents: "none" }} />

              {/* Icon */}
              <div style={{ width: 46, height: 46, borderRadius: 12, background: f.accentBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                <f.icon style={{ width: 22, height: 22, color: f.accent }} />
              </div>

              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", margin: "0 0 10px 0", lineHeight: 1.3 }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7, margin: 0 }}>
                {f.description}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
