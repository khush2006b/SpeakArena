"use client";

import React, { useState } from "react";
import { Mail, Phone, MapPin, Clock, Send, Twitter, Linkedin, Github } from "lucide-react";

const CONTACT_ITEMS = [
  { icon: Mail, label: "Email us", lines: ["support@speakarena.com", "enterprise@speakarena.com"], color: "#818cf8" },
  { icon: Phone, label: "Call us", lines: ["+91 93898 52850"], color: "#34d399" },
  { icon: MapPin, label: "Visit us", lines: ["New Delhi, India"], color: "#f87171" },
  { icon: Clock, label: "Business hours", lines: ["Monday – Friday", "9:00 AM – 6:00 PM (PST)"], color: "#fbbf24" },
];

const SOCIALS = [
  { icon: Twitter, label: "Twitter" },
  { icon: Linkedin, label: "LinkedIn" },
  { icon: Github, label: "GitHub" },
];

export function ContactSection() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = "Name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Valid email required";
    if (form.message.trim().length < 10) errs.message = "Message must be at least 10 characters";
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 1200));
    setSending(false);
    setSent(true);
    setForm({ name: "", email: "", message: "" });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    padding: "13px 16px", fontSize: 14,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 11, color: "#e5e7eb", outline: "none",
    fontFamily: "inherit",
  };

  return (
    <section id="contact" style={{ width: "100%", background: "#080c14", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 1, background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.3), transparent)" }} />
      <div style={{ position: "absolute", bottom: 0, right: 0, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.07) 0%, transparent 70%)", transform: "translate(30%, 30%)", pointerEvents: "none" }} />

      <div className="w-full px-6 sm:px-12 lg:px-20 py-16 sm:py-20 lg:py-28" style={{ position: "relative", zIndex: 10 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 100, padding: "6px 16px", marginBottom: 20 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#818cf8", display: "inline-block" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Get In Touch</span>
          </div>
          <h2 style={{ fontSize: "clamp(28px, 3.5vw, 48px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.1, margin: "0 0 18px 0" }}>
            We'd love to hear from you
          </h2>
          <p style={{ fontSize: 16, color: "#6b7280", lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>
            Questions about our curriculum, pricing, or enterprise plans? Our team is ready to help.
          </p>
        </div>

        {/* 2-col grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">

          {/* ─── LEFT: Form ──────────────────────────────────────────── */}
          <div className="p-5 sm:p-8 lg:p-10" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 22 }}>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", margin: "0 0 32px 0" }}>Send us a message</h3>

            {sent ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px auto" }}>
                  <Send style={{ width: 22, height: 22, color: "#34d399" }} />
                </div>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", margin: "0 0 8px 0" }}>Message sent!</p>
                <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>We'll get back to you within 24 hours.</p>
                <button onClick={() => setSent(false)} style={{ marginTop: 24, fontSize: 13, color: "#818cf8", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", display: "block", marginBottom: 8 }}>Full Name</label>
                  <input
                    style={{ ...inputStyle, borderColor: errors.name ? "#f87171" : "rgba(255,255,255,0.1)" }}
                    placeholder="John Doe"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    onFocus={e => { if (!errors.name) e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
                    onBlur={e => { if (!errors.name) e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                  />
                  {errors.name && <p style={{ fontSize: 12, color: "#f87171", margin: "6px 0 0 0" }}>{errors.name}</p>}
                </div>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", display: "block", marginBottom: 8 }}>Email Address</label>
                  <input
                    type="email"
                    style={{ ...inputStyle, borderColor: errors.email ? "#f87171" : "rgba(255,255,255,0.1)" }}
                    placeholder="john@company.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    onFocus={e => { if (!errors.email) e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
                    onBlur={e => { if (!errors.email) e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                  />
                  {errors.email && <p style={{ fontSize: 12, color: "#f87171", margin: "6px 0 0 0" }}>{errors.email}</p>}
                </div>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", display: "block", marginBottom: 8 }}>Message</label>
                  <textarea
                    rows={5}
                    style={{ ...inputStyle, resize: "none" as const, borderColor: errors.message ? "#f87171" : "rgba(255,255,255,0.1)" }}
                    placeholder="How can we help you?"
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    onFocus={e => { if (!errors.message) e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
                    onBlur={e => { if (!errors.message) e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                  />
                  {errors.message && <p style={{ fontSize: 12, color: "#f87171", margin: "6px 0 0 0" }}>{errors.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    padding: "14px 0", borderRadius: 12, fontSize: 15, fontWeight: 700,
                    background: sending ? "#3730a3" : "#4f46e5", color: "#fff", border: "none",
                    cursor: sending ? "not-allowed" : "pointer", transition: "background 0.15s", width: "100%",
                  }}
                  onMouseEnter={e => { if (!sending) (e.currentTarget as HTMLElement).style.background = "#4338ca"; }}
                  onMouseLeave={e => { if (!sending) (e.currentTarget as HTMLElement).style.background = "#4f46e5"; }}
                >
                  {sending ? (
                    <>
                      <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                      Sending...
                    </>
                  ) : (
                    <>Send Message <Send style={{ width: 16, height: 16 }} /></>
                  )}
                </button>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </form>
            )}
          </div>

          {/* ─── RIGHT: Contact info + Map ───────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {/* Contact items */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CONTACT_ITEMS.map(({ icon: Icon, label, lines, color }) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "22px 22px" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                    <Icon style={{ width: 18, height: 18, color }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#e5e7eb", marginBottom: 8 }}>{label}</div>
                  {lines.map((l, i) => (
                    <div key={i} style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{l}</div>
                  ))}
                </div>
              ))}
            </div>

            {/* Map placeholder */}
            <div style={{
              flex: 1, minHeight: 200, borderRadius: 18, overflow: "hidden",
              background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, position: "relative",
            }}>
              <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.04) 1px, transparent 0)", backgroundSize: "24px 24px" }} />
              <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(79,70,229,0.2)", border: "1px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px auto" }}>
                  <MapPin style={{ width: 22, height: 22, color: "#818cf8" }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#e5e7eb" }}>Headquarters</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>New Delhi, India</div>
              </div>
            </div>

            {/* Socials */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>Follow us:</span>
              {SOCIALS.map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  style={{ width: 38, height: 38, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", transition: "border-color 0.15s, color 0.15s, background 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,102,241,0.4)"; (e.currentTarget as HTMLElement).style.color = "#818cf8"; (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.08)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLElement).style.color = "#6b7280"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <Icon style={{ width: 16, height: 16 }} />
                </a>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
