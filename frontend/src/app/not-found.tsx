/**
 * Global 404 Not Found page.
 *
 * Rendered when no route matches. Provides navigation back to
 * the home page with a clean, minimal dark design.
 */

import Link from "next/link";
import { ROUTES } from "@/constants/routes";
import { FileQuestion, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
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
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 500, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Icon */}
      <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(79,70,229,0.1)", border: "1px solid rgba(99,102,241,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <FileQuestion style={{ width: 32, height: 32, color: "#818cf8" }} />
      </div>

      <div>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 12 }}>
          404
        </p>
        <h1 style={{ fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1.1, margin: "0 0 14px 0" }}>
          Page not found
        </h1>
        <p style={{ fontSize: 16, color: "#6b7280", maxWidth: 420, margin: 0, lineHeight: 1.65 }}>
          The page you're looking for doesn't exist or has been moved. Let's get you back on track.
        </p>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href={ROUTES.HOME}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "#4f46e5", color: "#fff", borderRadius: 10,
            padding: "11px 22px", fontSize: 14, fontWeight: 700,
            textDecoration: "none", transition: "background 0.15s",
          }}
        >
          <Home style={{ width: 15, height: 15 }} />
          Return home
        </Link>
        <Link
          href="javascript:history.back()"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#9ca3af", borderRadius: 10, padding: "11px 22px",
            fontSize: 14, fontWeight: 600, textDecoration: "none",
          }}
        >
          <ArrowLeft style={{ width: 15, height: 15 }} />
          Go back
        </Link>
      </div>
    </div>
  );
}
