"use client";

import React, { useState } from "react";
import { GraduationCap, Wrench, Zap } from "lucide-react";

// ─── GLOBE ILLUSTRATION ────────────────────────────────────────────────────────
function GlobeIllustration() {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 380, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Orbit rings */}
      <div style={{ position: "absolute", width: 440, height: 440, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.06)", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 360, height: 360, borderRadius: "50%", border: "1px dashed rgba(99,102,241,0.25)", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />
      
      {/* Glow background */}
      <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.25) 0%, rgba(79,70,229,0.1) 50%, transparent 70%)", top: "50%", left: "50%", transform: "translate(-50%,-50%)", filter: "blur(28px)", pointerEvents: "none" }} />

      {/* Main Globe SVG */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="260" height="260" viewBox="0 0 280 280" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: "drop-shadow(0 0 35px rgba(99,102,241,0.35))" }}>
          <circle cx="140" cy="140" r="130" fill="url(#globeGrad)" />
          
          {/* Latitude & Longitude Lines */}
          <ellipse cx="140" cy="140" rx="130" ry="52" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" fill="none" />
          <ellipse cx="140" cy="140" rx="130" ry="95" stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none" />
          <ellipse cx="140" cy="140" rx="52" ry="130" stroke="rgba(255,255,255,0.14)" strokeWidth="1" fill="none" />
          <line x1="140" y1="10" x2="140" y2="270" stroke="rgba(255,255,255,0.14)" strokeWidth="1.2" />
          <line x1="10" y1="140" x2="270" y2="140" stroke="rgba(255,255,255,0.14)" strokeWidth="1.2" />
          
          {/* Outer Ring */}
          <circle cx="140" cy="140" r="130" stroke="rgba(129,140,248,0.45)" strokeWidth="2" fill="none" />

          {/* Continents / Landmass Shapes */}
          <path d="M95 105 Q112 88 136 95 Q153 102 148 116 Q142 131 125 129 Q103 127 95 105Z" fill="rgba(129,140,248,0.4)" />
          <path d="M153 122 Q170 110 190 116 Q203 126 197 140 Q192 155 174 153 Q157 151 153 122Z" fill="rgba(99,102,241,0.35)" />
          <path d="M99 153 Q114 143 127 150 Q140 159 132 174 Q124 187 110 181 Q96 174 99 153Z" fill="rgba(79,70,229,0.38)" />

          {/* Glowing Connection Nodes */}
          <circle cx="110" cy="115" r="4" fill="#818cf8" />
          <circle cx="170" cy="130" r="4" fill="#34d399" />
          <circle cx="170" cy="130" r="7" stroke="#34d399" strokeWidth="1" fill="none" />
          <circle cx="120" cy="165" r="4" fill="#fbbf24" />

          <defs>
            <radialGradient id="globeGrad" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="45%" stopColor="#1e1b4b" />
              <stop offset="95%" stopColor="#0b0e18" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      {/* ── Floating Badges (All 4 Cards) ─────────────────────────────────── */}

      {/* 1. Top Right Card */}
      <div style={{
        position: "absolute", top: "2%", right: "0%",
        background: "rgba(15, 23, 42, 0.95)", border: "1px solid rgba(99, 102, 241, 0.3)",
        borderRadius: 14, padding: "8px 14px", display: "flex", alignItems: "center", gap: 10,
        boxShadow: "0 10px 25px rgba(0,0,0,0.5)", backdropFilter: "blur(12px)", zIndex: 10,
      }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
          A
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>Speaking</div>
          <div style={{ fontSize: 11, color: "#a5b4fc" }}>Band 8.0</div>
        </div>
      </div>

      {/* 2. Mid Left Card */}
      <div style={{
        position: "absolute", top: "34%", left: "0%",
        background: "rgba(15, 23, 42, 0.95)", border: "1px solid rgba(16, 185, 129, 0.3)",
        borderRadius: 14, padding: "8px 14px",
        boxShadow: "0 10px 25px rgba(0,0,0,0.5)", backdropFilter: "blur(12px)", zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#e11d48", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>
            S
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>Live Session</span>
        </div>
        <div style={{ fontSize: 10, color: "#34d399", marginTop: 4, display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
          48 online
        </div>
      </div>

      {/* 3. Bottom Left Card */}
      <div style={{
        position: "absolute", bottom: "4%", left: "0%",
        background: "rgba(15, 23, 42, 0.95)", border: "1px solid rgba(99, 102, 241, 0.3)",
        borderRadius: 14, padding: "8px 14px", display: "flex", alignItems: "center", gap: 10,
        boxShadow: "0 10px 25px rgba(0,0,0,0.5)", backdropFilter: "blur(12px)", zIndex: 10,
      }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#059669", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
          M
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>Accent</div>
          <div style={{ fontSize: 11, color: "#6ee7b7" }}>Certified ✓</div>
        </div>
      </div>

      {/* 4. Bottom Right Card */}
      <div style={{
        position: "absolute", bottom: "4%", right: "0%",
        background: "rgba(15, 23, 42, 0.95)", border: "1px solid rgba(245, 158, 11, 0.3)",
        borderRadius: 14, padding: "8px 14px",
        boxShadow: "0 10px 25px rgba(0,0,0,0.5)", backdropFilter: "blur(12px)", zIndex: 10,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Pronunciation</div>
        <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 500, marginTop: 2 }}>⭐ 4.9 · 1,240 students</div>
      </div>

    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export function MavenHeroSection() {
  const [activeTab, setActiveTab] = useState<"cohorts" | "workshops" | "free">("cohorts");

  return (
    <div className="w-full bg-background text-foreground transition-colors duration-200 overflow-x-hidden">
      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section style={{ position: "relative", width: "100%", overflow: "hidden", maxWidth: "100vw" }}>
        {/* Grid bg */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "44px 44px", pointerEvents: "none" }} />
        {/* Right-side glow */}
        <div style={{ position: "absolute", top: 0, right: 0, width: "55%", height: "100%", background: "radial-gradient(ellipse at 80% 40%, rgba(79,70,229,0.15) 0%, transparent 65%)", pointerEvents: "none" }} />

        <div className="w-full px-4 sm:px-8 lg:px-16 xl:px-20" style={{ position: "relative", zIndex: 10 }}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 lg:gap-12 py-10 sm:py-14 lg:py-16">

            {/* LEFT: Hero text */}
            <div className="w-full md:w-1/2 lg:pr-8 flex flex-col justify-center">
              <h1 style={{ fontSize: "clamp(28px, 5vw, 64px)", fontWeight: 900, color: "#ffffff", lineHeight: 1.08, letterSpacing: "-0.035em", margin: "0 0 22px 0" }}>
                Your English. Your Voice. Your Progress.<br />
                <span style={{ fontStyle: "normal", color: "#818cf8" }}>It all starts here.</span>
              </h1>
              <p style={{ fontSize: 18, color: "#9ca3af", lineHeight: 1.7, margin: 0, maxWidth: 460, fontWeight: 400 }}>
                Daily live classes, interactive practice, and something new to learn every day.
              </p>
            </div>

            {/* RIGHT: Globe — guaranteed height & visibility for all 4 cards */}
            <div className="w-full md:w-1/2 min-h-[380px] sm:min-h-[440px] flex items-center justify-center relative py-4">
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
