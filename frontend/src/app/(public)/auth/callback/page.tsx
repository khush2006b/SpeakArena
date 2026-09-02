"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { authService } from "@/services/auth.service";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const at = searchParams.get("at");
    const role = searchParams.get("role");
    const rt = searchParams.get("rt");   // raw refresh token from OAuth redirect
    const err = searchParams.get("error");

    if (err || !at) {
      setError("Sign in failed. Please try again.");
      return;
    }

    async function finishLogin() {
      try {
        // Store access token so apiClient can use it for /auth/me
        const { setAccessToken } = await import("@/services/api/interceptors");
        setAccessToken(at!);

        // Fetch full user profile
        const user = await authService.getMe();

        // Store in Zustand + localStorage
        setUser(user, at!);

        // Set cookies for middleware route protection
        const maxAge = 60 * 60 * 24 * 30; // 30 days
        document.cookie = `sa_auth=1; path=/; max-age=${maxAge}; SameSite=Lax`;
        document.cookie = `sa_role=${user.role}; path=/; max-age=${maxAge}; SameSite=Lax`;

        // Store the refresh token as a first-party HttpOnly cookie on speakarena.com
        // via a Next.js API route. This is needed because the backend sets the RT
        // cookie on speakarena.onrender.com, but our Vercel proxy sends /auth/refresh
        // from speakarena.com — so the browser never sends the backend-domain cookie.
        if (rt) {
          try {
            await fetch("/api/auth/set-cookie", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rt }),
            });
          } catch {
            // Non-fatal — user can still use the app with the in-memory AT
          }
        }

        // Redirect to correct dashboard
        if (user.role === "teacher") {
          router.replace("/teacher");
        } else {
          router.replace("/student");
        }
      } catch (e) {
        console.error("Auth callback error:", e);
        setError("Failed to complete sign in. Please try again.");
      }
    }

    finishLogin();
  }, [searchParams, setUser, router]);

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#080c14",
          gap: 16,
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 12,
            padding: "14px 18px",
            maxWidth: 400,
            width: "100%",
          }}
        >
          <AlertCircle style={{ width: 18, height: 18, color: "#f87171", flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: "#f87171" }}>{error}</span>
        </div>
        <button
          onClick={() => router.replace("/login")}
          style={{
            padding: "10px 24px",
            borderRadius: 10,
            background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
            border: "none",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#080c14",
        gap: 16,
      }}
    >
      <Loader2
        style={{
          width: 40,
          height: 40,
          color: "#4f46e5",
          animation: "spin 1s linear infinite",
        }}
      />
      <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
        Signing you in…
      </p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <React.Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#080c14",
          }}
        >
          <Loader2
            style={{
              width: 40,
              height: 40,
              color: "#4f46e5",
              animation: "spin 1s linear infinite",
            }}
          />
        </div>
      }
    >
      <AuthCallbackInner />
    </React.Suspense>
  );
}
