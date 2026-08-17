"use client";

import React, { useState } from "react";
import { Search, Plus, Minus } from "lucide-react";

const FAQS = [
  {
    category: "Pricing & Billing",
    question: "Do you offer refunds?",
    answer: "Yes — we offer a 14-day money-back guarantee on all premium and lifetime plans. If you're not satisfied for any reason, email support and we'll refund you immediately, no questions asked.",
  },
  {
    category: "Pricing & Billing",
    question: "Can I upgrade from Free to Premium later?",
    answer: "Absolutely. You can start with the free plan and upgrade to Premium at any time from your billing dashboard. Your progress and course history will be seamlessly transferred.",
  },
  {
    category: "Platform Features",
    question: "How do the live Google Meet classes work?",
    answer: "Premium members receive calendar invites for live cohort sessions. These are interactive classes where you speak directly with the instructor, share your screen, practice pronunciation drills, and get real-time feedback.",
  },
  {
    category: "Platform Features",
    question: "Are the lectures recorded?",
    answer: "Yes! If you miss a live Google Meet session, the HD recording is automatically uploaded to the platform within 24 hours. You can watch it anytime with our custom video player.",
  },
  {
    category: "Platform Features",
    question: "How does assignment grading work?",
    answer: "You submit speaking recordings or written assignments through the platform. Our AI provides an initial score, then certified instructors add detailed line-by-line feedback on pronunciation, grammar, and fluency.",
  },
  {
    category: "General",
    question: "Do I get a certificate upon completion?",
    answer: "Yes. Once you complete all modules and pass the final capstone project, you receive a verifiable digital certificate that you can share directly to LinkedIn.",
  },
  {
    category: "General",
    question: "Are the payments secure?",
    answer: "We use Stripe and Razorpay for all transactions. We do not store any credit card information on our servers — the entire process is 100% bank-grade secure.",
  },
];

export function FAQSection() {
  const [search, setSearch] = useState("");
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const filtered = FAQS.filter(f =>
    f.question.toLowerCase().includes(search.toLowerCase()) ||
    f.answer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section style={{ width: "100%", background: "#0b0e18", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 1, background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.3), transparent)" }} />

      <div className="w-full px-6 sm:px-12 lg:px-20" style={{ paddingTop: 96, paddingBottom: 100, position: "relative", zIndex: 10 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 100, padding: "6px 16px", marginBottom: 20 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", display: "inline-block" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Support</span>
          </div>
          <h2 style={{ fontSize: "clamp(28px, 3.5vw, 48px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.1, margin: "0 0 18px 0" }}>
            Frequently asked questions
          </h2>
          <p style={{ fontSize: 16, color: "#6b7280", lineHeight: 1.7, maxWidth: 460, margin: "0 auto 36px auto" }}>
            Can't find what you're looking for? Reach out to our support team anytime.
          </p>

          {/* Search */}
          <div style={{ position: "relative", maxWidth: 520, margin: "0 auto" }}>
            <Search style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", width: 18, height: 18, color: "#4b5563", pointerEvents: "none" }} />
            <input
              type="text"
              placeholder="Search questions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", boxSizing: "border-box",
                paddingLeft: 50, paddingRight: 18, paddingTop: 14, paddingBottom: 14,
                fontSize: 14, background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
                color: "#e5e7eb", outline: "none",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)")}
              onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>
        </div>

        {/* Accordion */}
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "64px 0", color: "#4b5563" }}>
              <Search style={{ width: 36, height: 36, margin: "0 auto 16px auto", opacity: 0.3 }} />
              <p style={{ fontSize: 15 }}>No questions found for "{search}"</p>
            </div>
          ) : (
            filtered.map((faq, i) => (
              <div
                key={faq.question}
                style={{
                  background: openIdx === i ? "rgba(99,102,241,0.06)" : "rgba(255,255,255,0.025)",
                  border: openIdx === i ? "1px solid rgba(99,102,241,0.25)" : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 16, overflow: "hidden", transition: "border-color 0.2s, background 0.2s",
                }}
              >
                <button
                  onClick={() => setOpenIdx(openIdx === i ? null : i)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "22px 24px", background: "none", border: "none", cursor: "pointer", textAlign: "left", gap: 16,
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 600, color: openIdx === i ? "#e5e7eb" : "#d1d5db", lineHeight: 1.4 }}>
                    {faq.question}
                  </span>
                  <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: "50%", background: openIdx === i ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}>
                    {openIdx === i
                      ? <Minus style={{ width: 14, height: 14, color: "#818cf8" }} />
                      : <Plus style={{ width: 14, height: 14, color: "#6b7280" }} />
                    }
                  </div>
                </button>

                {openIdx === i && (
                  <div style={{ padding: "0 24px 24px 24px" }}>
                    <p style={{ fontSize: 15, color: "#9ca3af", lineHeight: 1.75, margin: 0 }}>{faq.answer}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

      </div>
    </section>
  );
}
