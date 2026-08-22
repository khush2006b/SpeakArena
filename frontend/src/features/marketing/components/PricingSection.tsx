"use client";

import React from "react";
import { Check, X, ShieldCheck, CreditCard, Zap } from "lucide-react";
import Link from "next/link";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    interval: "forever",
    description: "Explore the platform and learn the basics at no cost.",
    features: [
      "Access to 3 introductory courses",
      "Community forum access",
      "Standard video quality",
      "Public Discord channel",
    ],
    notIncluded: [
      "Live Google Meet sessions",
      "Assignment grading",
      "1-on-1 mentorship",
      "Certificate of completion",
    ],
    featured: false,
    cta: "Get Started Free",
    ctaStyle: "outline" as const,
    accentColor: "#6b7280",
  },
  {
    name: "Premium",
    price: "$49",
    interval: "/month",
    description: "Everything you need to master advanced English communication.",
    badge: "Most Popular",
    features: [
      "Access to ALL courses & pathways",
      "Live cohort sessions (Google Meet)",
      "Priority assignment grading",
      "Private VIP Discord channel",
      "1-on-1 mentorship (1 hr/month)",
      "Certificate of completion",
      "HD & 4K video quality",
    ],
    notIncluded: [],
    featured: true,
    cta: "Start Premium",
    ctaStyle: "primary" as const,
    accentColor: "#4f46e5",
  },
  {
    name: "Lifetime Access",
    price: "$499",
    interval: "one-time",
    description: "Pay once. Own all current and future courses forever.",
    features: [
      "Everything in Premium",
      "Lifetime access to all updates",
      "Downloadable course videos",
      "Early access to new features",
      "Exclusive alumni network",
    ],
    notIncluded: [],
    featured: false,
    cta: "Buy Lifetime",
    ctaStyle: "outline" as const,
    accentColor: "#f59e0b",
  },
];

export function PricingSection() {
  return (
    <section style={{ width: "100%", background: "#080c14", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 1, background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.3), transparent)" }} />
      <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)", width: 800, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div className="w-full px-6 sm:px-12 lg:px-20 py-16 sm:py-20 lg:py-28" style={{ position: "relative", zIndex: 10 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 100, padding: "6px 16px", marginBottom: 20 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", display: "inline-block" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Pricing</span>
          </div>
          <h2 style={{ fontSize: "clamp(28px, 3.5vw, 48px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.1, margin: "0 0 18px 0" }}>
            Invest in your English career
          </h2>
          <p style={{ fontSize: 16, color: "#6b7280", lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>
            Transparent pricing with no hidden fees. Start for free, upgrade when you need live guidance.
          </p>
        </div>

        {/* 3-col pricing cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                background: tier.featured ? "rgba(79,70,229,0.08)" : "rgba(255,255,255,0.025)",
                border: tier.featured ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.07)",
                borderRadius: 22,
                overflow: "hidden",
                transition: "transform 0.2s",
              }}
            >
              {/* Top accent bar for featured */}
              {tier.featured && (
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #4f46e5, #818cf8, #a78bfa)" }} />
              )}

              <div className="p-6 sm:p-8">
                {/* Badge */}
                {tier.badge && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 100, padding: "4px 12px", marginBottom: 20 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: "0.06em" }}>{tier.badge}</span>
                  </div>
                )}

                {/* Name */}
                <h3 style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9", margin: "0 0 8px 0" }}>{tier.name}</h3>
                <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, margin: "0 0 28px 0", minHeight: 40 }}>{tier.description}</p>

                {/* Price */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 32 }}>
                  <span style={{ fontSize: 48, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1 }}>{tier.price}</span>
                  <span style={{ fontSize: 14, color: "#6b7280", fontWeight: 500 }}>{tier.interval}</span>
                </div>

                {/* CTA Button */}
                <Link
                  href="/register"
                  style={{
                    display: "block", width: "100%", textAlign: "center",
                    padding: "13px 0", borderRadius: 11, fontSize: 15, fontWeight: 700,
                    textDecoration: "none",
                    background: tier.featured ? "#4f46e5" : "transparent",
                    color: tier.featured ? "#fff" : "#9ca3af",
                    border: tier.featured ? "none" : "1px solid rgba(255,255,255,0.12)",
                    marginBottom: 32,
                    transition: "background 0.15s, color 0.15s",
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    if (tier.featured) el.style.background = "#4338ca";
                    else { el.style.background = "rgba(255,255,255,0.06)"; el.style.color = "#fff"; }
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    if (tier.featured) el.style.background = "#4f46e5";
                    else { el.style.background = "transparent"; el.style.color = "#9ca3af"; }
                  }}
                >
                  {tier.cta}
                </Link>

                {/* Divider */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 28 }}>
                  {/* Included */}
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                    {tier.features.map(f => (
                      <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#e5e7eb", lineHeight: 1.5 }}>
                        <Check style={{ width: 16, height: 16, color: "#4f46e5", flexShrink: 0, marginTop: 2 }} />
                        {f}
                      </li>
                    ))}
                    {tier.notIncluded.map(f => (
                      <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#4b5563", lineHeight: 1.5 }}>
                        <X style={{ width: 16, height: 16, color: "#374151", flexShrink: 0, marginTop: 2 }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 40, marginTop: 48, flexWrap: "wrap" }}>
          {[
            { icon: ShieldCheck, label: "14-Day Money-Back Guarantee", color: "#10b981" },
            { icon: CreditCard, label: "Secure Payments via Stripe", color: "#6b7280" },
            { icon: Zap, label: "Instant Access", color: "#fbbf24" },
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#6b7280", fontWeight: 500 }}>
              <Icon style={{ width: 17, height: 17, color }} />
              {label}
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
