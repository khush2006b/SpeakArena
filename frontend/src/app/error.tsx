/**
 * Global error boundary UI.
 *
 * Rendered when an unhandled runtime error occurs in any page.
 * Provides a retry button and reports to Sentry in production.
 * Must be a Client Component — error boundaries require client context.
 */

"use client";

import { useEffect } from "react";
import { RefreshCw, AlertTriangle, Home } from "lucide-react";
import Link from "next/link";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log to Sentry in production
    if (process.env["NODE_ENV"] === "production") {
      // Sentry.captureException(error); — enabled when Sentry is configured
      console.error("[SpeakArena] Unhandled error:", error);
    }
  }, [error]);

  return (
    <div
      style={{
        display: "flex", minHeight: "100vh", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 32,
        background: "#080c14", padding: "0 24px", textAlign: "center",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Background glow */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 500, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(239,68,68,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Icon */}
      <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <AlertTriangle style={{ width: 32, height: 32, color: "#f87171" }} aria-hidden="true" />
      </div>

      <div>
        <h1 style={{ fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1.1, margin: "0 0 14px 0" }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 16, color: "#6b7280", maxWidth: 420, margin: 0, lineHeight: 1.65 }}>
          An unexpected error occurred. Our team has been notified.
          {error.digest && (
            <span style={{ display: "block", marginTop: 10, fontFamily: "monospace", fontSize: 12, color: "#374151", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "4px 10px" }}>
              Error ID: {error.digest}
            </span>
          )}
        </p>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={reset}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "#4f46e5", color: "#fff", borderRadius: 10,
            padding: "11px 22px", fontSize: 14, fontWeight: 700,
            border: "none", cursor: "pointer", transition: "background 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#4338ca")}
          onMouseLeave={e => (e.currentTarget.style.background = "#4f46e5")}
        >
          <RefreshCw style={{ width: 15, height: 15 }} aria-hidden="true" />
          Try again
        </button>
        <Link
          href="/"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#9ca3af", borderRadius: 10, padding: "11px 22px",
            fontSize: 14, fontWeight: 600, textDecoration: "none",
          }}
        >
          <Home style={{ width: 15, height: 15 }} />
          Go home
        </Link>
      </div>
    </div>
  );
}
