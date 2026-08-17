"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { ResetPasswordForm } from "./ResetPasswordForm";

interface ResetPasswordClientPageProps {
  token: string;
}

export function ResetPasswordClientPage({ token }: ResetPasswordClientPageProps) {
  if (!token) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", margin: 0 }}>
            Invalid reset link
          </h1>
          <p style={{ fontSize: 15, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>
            This password reset link is invalid or has expired.
            Reset links are valid for 15 minutes.
          </p>
        </div>

        {/* Error alert */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 12, padding: "14px 16px",
        }}>
          <AlertCircle style={{ width: 16, height: 16, color: "#f87171", flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 14, color: "#fca5a5", margin: 0, lineHeight: 1.55 }}>
            No reset token found. Please request a new password reset link.
          </p>
        </div>

        {/* CTA button */}
        <Link
          href="/forgot-password"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "100%", padding: "13px 0", borderRadius: 12,
            background: "#4f46e5", color: "#fff", fontWeight: 700, fontSize: 15,
            textDecoration: "none", transition: "background 0.15s",
          }}
        >
          Request new link
        </Link>

        <p style={{ textAlign: "center", fontSize: 14, color: "#6b7280", margin: 0 }}>
          Remembered your password?{" "}
          <Link href="/login" style={{ color: "#818cf8", fontWeight: 600, textDecoration: "none" }}>
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
