"use client";

import React, { useState } from "react";
import { GraduationCap, Wrench, Zap } from "lucide-react";

// ─── GLOBE ILLUSTRATION ────────────────────────────────────────────────────────
function GlobeIllustration() {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Orbit rings */}
      <div style={{ position: "absolute", width: 460, height: 460, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.05)", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
      <div style={{ position: "absolute", width: 370, height: 370, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.05)", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
      {/* Glow */}
      <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)", top: "50%", left: "50%", transform: "translate(-50%,-50%)", filter: "blur(24px)" }} />

      {/* Globe SVG */}
      <svg width="260" height="260" viewBox="0 0 260 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "relative", zIndex: 2, flexShrink: 0 }}>
        <circle cx="130" cy="130" r="118" fill="url(#globeGrad)" />
        <ellipse cx="130" cy="130" rx="118" ry="47" stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none" />
        <ellipse cx="130" cy="130" rx="118" ry="86" stroke="rgba(255,255,255,0.08)" strokeWidth="1" fill="none" />
        <line x1="130" y1="12" x2="130" y2="248" stroke="rgba(255,255,255,0.09)" strokeWidth="1" />
        <line x1="12" y1="130" x2="248" y2="130" stroke="rgba(255,255,255,0.09)" strokeWidth="1" />
        <line x1="44" y1="28" x2="216" y2="232" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <line x1="216" y1="28" x2="44" y2="232" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <circle cx="130" cy="130" r="118" stroke="rgba(99,102,241,0.35)" strokeWidth="1.5" fill="none" />
        {/* Continents */}
        <path d="M88 98 Q104 82 126 89 Q142 95 137 108 Q132 122 116 120 Q96 118 88 98Z" fill="rgba(99,102,241,0.28)" />
        <path d="M142 114 Q158 103 176 108 Q188 117 183 130 Q178 144 162 142 Q146 140 142 114Z" fill="rgba(99,102,241,0.22)" />
        <path d="M92 142 Q106 133 118 140 Q130 148 123 162 Q115 174 102 168 Q89 162 92 142Z" fill="rgba(79,70,229,0.24)" />
        <defs>
          <radialGradient id="globeGrad" cx="38%" cy="34%" r="65%">
            <stop offset="0%" stopColor="#1e3a5f" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#060810" />
          </radialGradient>
        </defs>
      </svg>

      {/* Floating info cards */}
      {/* Top-right */}
      <div style={{ position: "absolute", top: "6%", right: "8%", background: "rgba(13,19,33,0.95)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, backdropFilter: "blur(12px)", boxShadow: "0 6px 28px rgba(0,0,0,0.45)", zIndex: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 }}>A</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>Speaking</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Band 8.0</div>
        </div>
      </div>
      {/* Left-mid */}
      <div style={{ position: "absolute", top: "36%", left: "1%", background: "rgba(13,19,33,0.95)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 14, padding: "10px 14px", backdropFilter: "blur(12px)", boxShadow: "0 6px 28px rgba(0,0,0,0.45)", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e11d48", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>S</div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>Live Session</span>
        </div>
        <div style={{ fontSize: 10, color: "#34d399", marginTop: 5, display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
          48 online
        </div>
      </div>
      {/* Bottom-left */}
      <div style={{ position: "absolute", bottom: "12%", left: "2%", background: "rgba(13,19,33,0.95)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, backdropFilter: "blur(12px)", boxShadow: "0 6px 28px rgba(0,0,0,0.45)", zIndex: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#059669", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 }}>M</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>Accent</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Certified ✓</div>
        </div>
      </div>
      {/* Bottom-right */}
      <div style={{ position: "absolute", bottom: "8%", right: "8%", background: "rgba(13,19,33,0.95)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 14, padding: "10px 14px", backdropFilter: "blur(12px)", boxShadow: "0 6px 28px rgba(0,0,0,0.45)", zIndex: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Pronunciation</div>
        <div style={{ fontSize: 11, color: "#fbbf24" }}>⭐ 4.9 · 1,240 students</div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export function MavenHeroSection() {
  const [activeTab, setActiveTab] = useState<"cohorts" | "workshops" | "free">("cohorts");

  // Shared horizontal padding matching the navbar: px-6 sm:px-12 lg:px-20

  return (
    <div className="w-full bg-[#0d1117] text-white overflow-x-hidden">
      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section style={{ position: "relative", width: "100%", overflow: "hidden", maxWidth: "100vw" }}>
        {/* Grid bg */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "44px 44px", pointerEvents: "none" }} />
        {/* Right-side glow */}
        <div style={{ position: "absolute", top: 0, right: 0, width: "55%", height: "100%", background: "radial-gradient(ellipse at 80% 40%, rgba(79,70,229,0.12) 0%, transparent 65%)", pointerEvents: "none" }} />

        <div className="w-full px-4 sm:px-8 lg:px-16 xl:px-20" style={{ position: "relative", zIndex: 10 }}>
          <div className="flex flex-col md:flex-row items-center gap-8 lg:gap-12">

            {/* LEFT: Hero text */}
            <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center" }} className="w-full md:w-[50%] lg:w-[48%] lg:pr-10 py-10 sm:py-14 lg:py-20">
              <h1 style={{ fontSize: "clamp(28px, 5vw, 64px)", fontWeight: 900, color: "#ffffff", lineHeight: 1.08, letterSpacing: "-0.035em", margin: "0 0 22px 0" }}>
                Your English. Your Voice. Your Progress.<br />
                <span style={{ fontStyle: "normal", color: "#818cf8" }}>It all starts here.</span>
              </h1>
              <p style={{ fontSize: 18, color: "#9ca3af", lineHeight: 1.7, margin: 0, maxWidth: 460, fontWeight: 400 }}>
                Daily live classes, interactive practice, and something new to learn every day.
              </p>
            </div>

            {/* RIGHT: Globe — visible on md+ screens (768px+) */}
            <div className="hidden md:flex" style={{ flex: 1, position: "relative", minHeight: 380 }}>
              <GlobeIllustration />
            </div>

          </div>
        </div>

        {/* ── 3 Feature Cards ─────────────────────────────────────────────── */}
        <div className="w-full px-4 sm:px-8 lg:px-16 xl:px-20 pb-12 relative z-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                id: "cohorts",
                icon: <GraduationCap style={{ width: 22, height: 22, color: "#818cf8" }} />,
                iconBg: "rgba(79,70,229,0.18)",
                title: "Cohort-based courses",
                desc: "Guided multi-week programs with live Google Meet practice & feedback.",
              },
              {
                id: "workshops",
                icon: <Wrench style={{ width: 22, height: 22, color: "#fbbf24" }} />,
                iconBg: "rgba(217,119,6,0.18)",
                title: "1-day workshops",
                desc: "Hands-on live sprints to practice pronunciation & public sessions.",
              },
              {
                id: "free",
                icon: <Zap style={{ width: 22, height: 22, color: "#34d399" }} />,
                iconBg: "rgba(5,150,105,0.18)",
                title: "Free Lightning Lessons",
                desc: "Interactive 30-min live sessions to explore accent & vocabulary drills.",
              },
            ].map((card) => (
              <button
                key={card.id}
                onClick={() => setActiveTab(card.id as typeof activeTab)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 16,
                  padding: "22px 24px", borderRadius: 14,
                  border: activeTab === card.id ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(255,255,255,0.08)",
                  background: activeTab === card.id ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                  cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                }}
              >
                <div style={{ padding: 10, borderRadius: 10, background: card.iconBg, flexShrink: 0 }}>
                  {card.icon}
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 6px 0" }}>{card.title}</h3>
                  <p style={{ fontSize: 13, color: "#9ca3af", margin: 0, lineHeight: 1.6 }}>{card.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
