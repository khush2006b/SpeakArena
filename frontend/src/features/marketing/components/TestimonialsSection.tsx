"use client";

import React from "react";

const TESTIMONIALS = [
  {
    name: "Alex Rivera",
    role: "Backend Engineer at Spotify",
    country: "🇸🇪 Sweden",
    content: "The Accent Reduction course changed how I present in English. My manager noticed the difference within weeks — clearer, more confident speech in every team standup.",
    rating: 5,
    initials: "AR",
    color: "#4f46e5",
  },
  {
    name: "Priya Patel",
    role: "Product Manager at Amazon",
    country: "🇺🇸 United States",
    content: "The live cohort structure creates real accountability. I passed IELTS Speaking Band 8 on my first attempt after just 5 weeks of sessions with Dr. Chen's team.",
    rating: 5,
    initials: "PP",
    color: "#059669",
  },
  {
    name: "David Kim",
    role: "CS Student at Waterloo",
    country: "🇨🇦 Canada",
    content: "SpeakArena's live Google Meet format makes every session feel like a real conversation — not a class. The pronunciation drills actually work. Highly recommend.",
    rating: 5,
    initials: "DK",
    color: "#0891b2",
  },
  {
    name: "Elena Sokolov",
    role: "Senior Developer",
    country: "🇩🇪 Germany",
    content: "My English fluency went from hesitant to confident in 8 weeks. The business communication module specifically helped me ace my Google interview in English.",
    rating: 5,
    initials: "ES",
    color: "#d97706",
  },
  {
    name: "James Chen",
    role: "Tech Lead at Stripe",
    country: "🇬🇧 United Kingdom",
    content: "I recommend this to all my colleagues who want to improve their professional English. The depth of the curriculum, especially for non-native speakers, is unmatched.",
    rating: 5,
    initials: "JC",
    color: "#7c3aed",
  },
  {
    name: "Aiko Tanaka",
    role: "UX Designer at Rakuten",
    country: "🇯🇵 Japan",
    content: "Finally a platform that treats pronunciation as a real skill to build. The phonetic analysis sessions opened my eyes to sounds I never knew I was missing.",
    rating: 5,
    initials: "AT",
    color: "#be185d",
  },
];

// Duplicate for infinite marquee
const DOUBLED = [...TESTIMONIALS, ...TESTIMONIALS];

function StarRow() {
  return (
    <div style={{ display: "flex", gap: 3, marginBottom: 18 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width="15" height="15" viewBox="0 0 24 24" fill="#fbbf24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
      ))}
    </div>
  );
}

export function TestimonialsSection() {
  return (
    <section style={{ width: "100%", background: "#0b0e18", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 1, background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.3), transparent)" }} />

      {/* Header */}
      <div className="w-full px-6 sm:px-12 lg:px-20" style={{ paddingTop: 96, paddingBottom: 56, position: "relative", zIndex: 10 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 100, padding: "6px 16px", marginBottom: 20 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", display: "inline-block" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Wall of Love</span>
          </div>
          <h2 style={{ fontSize: "clamp(28px, 3.5vw, 48px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.1, margin: "0 0 16px 0" }}>
            Loved by learners worldwide
          </h2>
          <p style={{ fontSize: 16, color: "#6b7280", lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>
            Join 50,000+ students who have transformed their spoken English with SpeakArena.
          </p>
        </div>
      </div>

      {/* Marquee container */}
      <div style={{ position: "relative", paddingBottom: 96 }}>
        {/* Fade masks */}
        <div style={{ position: "absolute", top: 0, left: 0, width: "12%", height: "100%", background: "linear-gradient(90deg, #0b0e18, transparent)", zIndex: 20, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 0, right: 0, width: "12%", height: "100%", background: "linear-gradient(270deg, #0b0e18, transparent)", zIndex: 20, pointerEvents: "none" }} />

        {/* Scrolling track — CSS animation */}
        <style>{`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .speakarena-marquee {
            display: flex;
            width: max-content;
            animation: marquee 48s linear infinite;
            gap: 20px;
            padding: 0 10px;
          }
          .speakarena-marquee:hover {
            animation-play-state: paused;
          }
        `}</style>

        <div style={{ overflow: "hidden" }}>
          <div className="speakarena-marquee">
            {DOUBLED.map((t, i) => (
              <div
                key={i}
                style={{
                  width: 360,
                  flexShrink: 0,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 20,
                  padding: "28px 28px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <StarRow />
                  <p style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.75, margin: "0 0 24px 0", fontStyle: "italic" }}>
                    "{t.content}"
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                    {t.initials}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#e5e7eb" }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{t.role} · {t.country}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
