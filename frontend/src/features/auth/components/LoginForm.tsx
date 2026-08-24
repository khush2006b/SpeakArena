"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useLogin } from "@/hooks/queries/useAuthQueries";
import { getErrorMessage, isValidationError, mapServerErrorsToForm } from "@/utils/errorHandler";
import { loginSchema, type LoginValues } from "../schemas/auth.schemas";

/* ── Inline SVG icons ── */
const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);
const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

/* ── Shared styles ── */
function inputWrapStyle(focused: boolean): React.CSSProperties {
  return {
    position: "relative",
    display: "flex",
    alignItems: "center",
    width: "100%",
    height: 46,
    borderRadius: 10,
    border: focused ? "1.5px solid #4f46e5" : "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.04)",
    boxShadow: focused ? "0 0 0 3px rgba(79,70,229,0.18)" : "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
    boxSizing: "border-box",
  };
}

const nativeInputStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  background: "transparent",
  border: "none",
  outline: "none",
  color: "#ffffff",
  fontSize: 14,
  paddingLeft: 42,
  paddingRight: 16,
  boxSizing: "border-box",
};

/** Redirect to backend Google OAuth — the backend issues the token after callback */
function handleGoogleLogin() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "https://speakarena.onrender.com";
  // Backend must expose GET /api/v1/auth/google/login which redirects to Google
  window.location.href = `${apiBase}/api/v1/auth/google/login`;
}

function LoginFormInner() {
  const [showPassword, setShowPassword] = React.useState(false);
  const [focused, setFocused] = React.useState<string | null>(null);
  const loginMutation = useLogin();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("registered") === "1";

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  async function onSubmit(data: LoginValues) {
    try {
      await loginMutation.mutateAsync({
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe ?? false,
      });
    } catch (error: any) {
      if (error?.status === 401 || error?.code === "InvalidCredentials") {
        form.setError("password", { type: "manual", message: "Incorrect password or email. Please check your credentials." });
        form.setError("email", { type: "manual", message: "Incorrect password or email." });
      } else if (isValidationError(error)) {
        mapServerErrorsToForm(error, form.setError as Parameters<typeof mapServerErrorsToForm>[1]);
      }
    }
  }

  const isLoading = loginMutation.isPending;
  const rawServerError = !isValidationError(loginMutation.error) && loginMutation.error
    ? getErrorMessage(loginMutation.error) : null;
  const serverError = (loginMutation.error as any)?.status === 401 || (loginMutation.error as any)?.code === "InvalidCredentials"
    ? "Incorrect password or email address. Please try again."
    : rawServerError;

  return (
    <div style={{ width: "100%" }}>

      {/* ── Heading block ── */}
      <h1 style={{ fontSize: 30, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.025em", margin: "0 0 8px 0" }}>
        Welcome Back!
      </h1>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", margin: "0 0 28px 0", lineHeight: 1.6 }}>
        Sign in to access your dashboard and continue your English fluency journey.
      </p>

      {/* Success banner */}
      {justRegistered && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
          <CheckCircle2 style={{ width: 16, height: 16, color: "#34d399", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#34d399" }}>Account created! You can now sign in.</span>
        </div>
      )}

      {/* Error banner */}
      {serverError && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
          <AlertCircle style={{ width: 16, height: 16, color: "#f87171", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#f87171" }}>{serverError}</span>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>

          {/* ── Email field ── */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 6 }}>
                  Email
                </label>
                <FormControl>
                  <div style={inputWrapStyle(focused === "email")}>
                    <span style={{ position: "absolute", left: 14, color: "rgba(255,255,255,0.4)", display: "flex" }}>
                      <MailIcon />
                    </span>
                    <input
                      id="login-email"
                      type="email"
                      placeholder="Enter your email"
                      autoComplete="email"
                      disabled={isLoading}
                      style={nativeInputStyle}
                      {...field}
                      onFocus={() => setFocused("email")}
                      onBlur={() => setFocused(null)}
                    />
                  </div>
                </FormControl>
                <FormMessage style={{ fontSize: 12, color: "#f87171", marginTop: 4 }} />
              </FormItem>
            )}
          />

          {/* ── Password field ── */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 6 }}>
                  Password
                </label>
                <FormControl>
                  <div style={inputWrapStyle(focused === "password")}>
                    <span style={{ position: "absolute", left: 14, color: "rgba(255,255,255,0.4)", display: "flex" }}>
                      <LockIcon />
                    </span>
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      disabled={isLoading}
                      style={{ ...nativeInputStyle, paddingRight: 44 }}
                      {...field}
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused(null)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      style={{ position: "absolute", right: 14, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex", padding: 0 }}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage style={{ fontSize: 12, color: "#f87171", marginTop: 4 }} />
              </FormItem>
            )}
          />

          {/* ── Remember Me + Forgot Password row ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <label
                  htmlFor="remember-me"
                  style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
                >
                  {/* Custom styled checkbox */}
                  <div style={{ position: "relative", width: 16, height: 16, flexShrink: 0 }}>
                    <input
                      id="remember-me"
                      type="checkbox"
                      checked={field.value ?? false}
                      onChange={field.onChange}
                      disabled={isLoading}
                      style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", margin: 0, cursor: "pointer" }}
                    />
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        border: field.value ? "1.5px solid #4f46e5" : "1.5px solid rgba(255,255,255,0.25)",
                        background: field.value ? "linear-gradient(135deg,#4f46e5,#7c3aed)" : "rgba(255,255,255,0.04)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.15s",
                        pointerEvents: "none",
                      }}
                    >
                      {field.value && (
                        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                          <path d="M1 3.5L3.5 6L8 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Remember me</span>
                </label>
              )}
            />
            <Link href="/forgot-password" style={{ fontSize: 13, fontWeight: 600, color: "#818cf8", textDecoration: "none" }}>
              Forgot Password?
            </Link>
          </div>

          {/* ── Sign In button ── */}
          <button
            id="login-submit"
            type="submit"
            disabled={isLoading}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              height: 46,
              borderRadius: 10,
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              border: "none",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.7 : 1,
              marginBottom: 20,
              transition: "opacity 0.15s, transform 0.1s",
            }}
          >
            {isLoading && <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />}
            {isLoading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </Form>

      {/* ── Footer link ── */}
      <p style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 24 }}>
        Don&apos;t have an Account?{" "}
        <Link href="/register" style={{ color: "#818cf8", fontWeight: 700, textDecoration: "none" }}>
          Sign Up
        </Link>
      </p>
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={null}>
      <LoginFormInner />
    </Suspense>
  );
}
