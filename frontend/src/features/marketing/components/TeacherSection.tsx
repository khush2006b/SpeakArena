"use client";

import React from "react";
import { GraduationCap } from "lucide-react";

export function TeacherSection() {
  return (
    <section style={{ width: "100%", background: "#0b0e18", position: "relative", overflow: "hidden" }}>
      {/* Background accent */}
      <div style={{ position: "absolute", top: 0, right: 0, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.09) 0%, transparent 70%)", transform: "translate(30%, -30%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(52,211,153,0.05) 0%, transparent 70%)", transform: "translate(-30%, 30%)", pointerEvents: "none" }} />

      <div className="w-full px-6 sm:px-12 lg:px-20 py-16 sm:py-20 lg:py-24" style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center" }}>
        
        {/* Section Header */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 100, padding: "6px 16px", marginBottom: 16 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", display: "inline-block" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Meet the Founder & Teacher</span>
        </div>

        <h2 style={{ fontSize: "clamp(26px, 3vw, 40px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", textAlign: "center", margin: "0 0 32px 0" }}>
          Paras (Construction)
        </h2>

        {/* Portrait Card */}
        <div style={{
          position: "relative", borderRadius: 24, overflow: "hidden",
          width: "100%", maxWidth: 360, aspectRatio: "4/5",
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
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "24px 24px 24px", zIndex: 2, textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(79,70,229,0.25)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: 100, padding: "4px 12px", marginBottom: 8, backdropFilter: "blur(8px)" }}>
              <GraduationCap style={{ width: 12, height: 12, color: "#818cf8" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.06em" }}>Founder & Teacher</span>
            </div>
            <h3 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: "0 0 4px 0", lineHeight: 1.2 }}>Paras (Construction)</h3>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: 0 }}>Founder & Lead Mentor · SpeakArena</p>
          </div>
        </div>

      </div>
    </section>
  );
}
