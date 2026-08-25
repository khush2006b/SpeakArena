"use client";

import React from "react";
import { Users, Star, Briefcase, Trophy, ArrowRight, GraduationCap } from "lucide-react";
import Link from "next/link";

const STATS = [
  { label: "Active Learners", value: "1,200+", icon: Users, color: "#818cf8" },
  { label: "Average Rating", value: "4.9 / 5", icon: Star, color: "#fbbf24" },
  { label: "Live Interactive Hours", value: "250+", icon: Briefcase, color: "#34d399" },
  { label: "Fluency Success Rate", value: "96%", icon: Trophy, color: "#f87171" },
];

const TIMELINE = [
  {
    year: "2024 – Present",
    role: "Founder & Lead Peer Coach",
    org: "SpeakArena",
    desc: "Building a high-energy, peer-driven English speaking platform where students break free from hesitation through real live practice and instant feedback.",
  },
  {
    year: "2023 – 2024",
    role: "Public Speaking & Debate Circle Lead",
    org: "University Campus",
    desc: "Mentored 300+ fellow college students in public speaking, impromptu presentation skills, and overcoming stage fear for placement interviews.",
  },
  {
    year: "2022 – 2023",
    role: "Spoken English Peer Trainer",
    org: "Campus English Club",
    desc: "Organized interactive daily practice circles focusing on natural pronunciation, sentence rhythm, and vocal confidence.",
  },
];

export function TeacherSection() {
  return (
    <section style={{ width: "100%", background: "#0b0e18", position: "relative", overflow: "hidden" }}>
      {/* Background accent */}
      <div style={{ position: "absolute", top: 0, right: 0, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.09) 0%, transparent 70%)", transform: "translate(30%, -30%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(52,211,153,0.05) 0%, transparent 70%)", transform: "translate(-30%, 30%)", pointerEvents: "none" }} />

      <div className="w-full px-6 sm:px-12 lg:px-20 py-16 sm:py-20 lg:py-28" style={{ position: "relative", zIndex: 10 }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-start">

          {/* ─── LEFT: Portrait + Stats ──────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

            {/* Portrait card */}
            <div style={{
              position: "relative", borderRadius: 24, overflow: "hidden",
              aspectRatio: "4/5", maxWidth: 400,
              background: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
            }}>
              {/* Teacher Image */}
              <img
                src="/images/paras_teacher.png"
                alt="Paras (Construction)"
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
              />
              {/* Gradient overlay */}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(11,14,24,0.92) 0%, rgba(11,14,24,0.2) 50%, transparent 100%)", zIndex: 1 }} />
              {/* Name card overlay */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "28px 28px 28px", zIndex: 2 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(79,70,229,0.25)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 100, padding: "4px 12px", marginBottom: 12, backdropFilter: "blur(8px)" }}>
                  <GraduationCap style={{ width: 12, height: 12, color: "#818cf8" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.06em" }}>Founder & Teacher</span>
                </div>
                <h3 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 6px 0", lineHeight: 1.2 }}>Paras (Construction)</h3>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", margin: 0 }}>Founder & Lead Mentor · SpeakArena</p>
              </div>
            </div>

            {/* Stats 2×2 grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {STATS.map((s) => (
                <div key={s.label} className="p-3 sm:p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16 }}>
                  <s.icon style={{ width: 20, height: 20, color: s.color, marginBottom: 12 }} />
                  <div className="text-2xl sm:text-3xl" style={{ fontWeight: 800, color: "#fff", lineHeight: 1, marginBottom: 6 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── RIGHT: Bio + Timeline ───────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* Label */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 100, padding: "6px 16px", marginBottom: 24, width: "fit-content" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", display: "inline-block" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Meet the Founder & Teacher</span>
            </div>

            <h2 style={{ fontSize: "clamp(28px, 3vw, 44px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.1, margin: "0 0 24px 0" }}>
              Real practice with someone who understands your journey.
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 48 }}>
              <p style={{ fontSize: 16, color: "#9ca3af", lineHeight: 1.75, margin: 0 }}>
                As a student, I experienced the exact same hesitation when speaking English in front of peers, seminars, and interviewers. Textbooks don't teach fluency — real speaking practice does.
              </p>
              <p style={{ fontSize: 16, color: "#9ca3af", lineHeight: 1.75, margin: 0 }}>
                My approach is simple: <strong style={{ color: "#e5e7eb", fontWeight: 700 }}>no judgment, zero fear, 100% active speaking.</strong> Together at SpeakArena, we turn awkward silences into confident, natural conversation.
              </p>
            </div>

            {/* Timeline */}
            <div style={{ position: "relative", paddingLeft: 28, borderLeft: "2px solid rgba(255,255,255,0.08)", marginLeft: 8, display: "flex", flexDirection: "column", gap: 36, marginBottom: 48 }}>
              {TIMELINE.map((item, i) => (
                <div key={i} style={{ position: "relative" }}>
                  {/* dot */}
                  <div style={{ position: "absolute", left: -37, top: 4, width: 14, height: 14, borderRadius: "50%", background: "#4f46e5", border: "3px solid #0b0e18", boxShadow: "0 0 0 3px rgba(79,70,229,0.3)" }} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{item.year}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.2, marginBottom: 4 }}>{item.role}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#4f46e5", marginBottom: 10 }}>{item.org}</div>
                  <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7, margin: 0 }}>{item.desc}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Link
              href="/courses"
              style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                background: "#4f46e5", color: "#fff", fontSize: 15, fontWeight: 700,
                padding: "14px 28px", borderRadius: 12, textDecoration: "none",
                width: "fit-content", transition: "background 0.15s, transform 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#4338ca"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#4f46e5"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
            >
              View All Courses <ArrowRight style={{ width: 18, height: 18 }} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
