"use client";

import React from "react";
import { Loader2 } from "lucide-react";

const GoogleLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

function handleGoogleSignup() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "https://speakarena.onrender.com";
  window.location.href = `${apiBase}/api/v1/auth/google/login`;
}

export function RegisterForm() {
  const [isLoading, setIsLoading] = React.useState(false);

  function onGoogleClick() {
    setIsLoading(true);
    handleGoogleSignup();
  }

  return (
    <div style={{ width: "100%" }}>

      {/* ── Heading block ── */}
      <h1 style={{ fontSize: 30, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.025em", margin: "0 0 8px 0" }}>
        Create an Account
      </h1>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", margin: "0 0 36px 0", lineHeight: 1.6 }}>
        Join SpeakArena and start your English fluency journey today.
      </p>

      {/* ── Google Sign Up Button ── */}
      <button
        onClick={onGoogleClick}
        disabled={isLoading}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          width: "100%",
          height: 50,
          borderRadius: 12,
          background: "#ffffff",
          border: "none",
          color: "#1f1f1f",
          fontSize: 15,
          fontWeight: 600,
          cursor: isLoading ? "not-allowed" : "pointer",
          opacity: isLoading ? 0.7 : 1,
          transition: "opacity 0.15s, box-shadow 0.15s",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          marginBottom: 24,
        }}
        onMouseEnter={e => { if (!isLoading) (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.35)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.25)"; }}
      >
        {isLoading ? (
          <Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite", color: "#4285F4" }} />
        ) : (
          <GoogleLogo />
        )}
        {isLoading ? "Redirecting to Google…" : "Continue with Google"}
      </button>

      {/* ── Already have account ── */}
      <p style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>
        Already have an account?{" "}
        <a href="/login" style={{ color: "#818cf8", fontWeight: 700, textDecoration: "none" }}>
          Sign In
        </a>
      </p>

      {/* ── Terms ── */}
      <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 10, lineHeight: 1.6 }}>
        By creating an account, you agree to our{" "}
        <a href="/terms" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "underline" }}>Terms of Service</a>
        {" "}and{" "}
        <a href="/privacy" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "underline" }}>Privacy Policy</a>.
      </p>
    </div>
  );
}
