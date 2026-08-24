"use client";

import React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, AlertCircle } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useRegister } from "@/hooks/queries/useAuthQueries";
import { getErrorMessage, isValidationError, mapServerErrorsToForm } from "@/utils/errorHandler";
import { registerSchema, type RegisterValues } from "../schemas/auth.schemas";
import { PasswordStrengthIndicator } from "./PasswordStrengthIndicator";

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
const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" />
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
const AppleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.87c.68-.82 1.14-1.97.97-3.13-.98.04-2.17.65-2.87 1.47-.63.73-1.18 1.9-1.03 3.03 1.1.09 2.23-.55 2.93-1.37z"/>
  </svg>
);

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

export function RegisterForm() {
  const [showPassword, setShowPassword] = React.useState(false);
  const [focused, setFocused] = React.useState<string | null>(null);
  const registerMutation = useRegister();

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "", role: "student" },
  });

  const passwordValue = form.watch("password");

  async function onSubmit(data: RegisterValues) {
    try {
      await registerMutation.mutateAsync({ fullName: data.fullName, email: data.email, password: data.password, role: "student" });
    } catch (error: any) {
      if (error?.status === 409 || error?.code === "EmailAlreadyExists") {
        form.setError("email", { type: "manual", message: "An account with this email address already exists. Please sign in instead." });
      } else if (isValidationError(error)) {
        mapServerErrorsToForm(error, form.setError as Parameters<typeof mapServerErrorsToForm>[1]);
      }
    }
  }

  const isLoading = registerMutation.isPending;
  const rawServerError = !isValidationError(registerMutation.error) && registerMutation.error
    ? getErrorMessage(registerMutation.error) : null;
  const serverError = (registerMutation.error as any)?.status === 409 || (registerMutation.error as any)?.code === "EmailAlreadyExists"
    ? "An account with this email address already exists. Please sign in instead."
    : rawServerError;

  return (
    <div style={{ width: "100%" }}>

      {/* ── Heading block (left-aligned, like SoftQA) ── */}
      <h1 style={{ fontSize: 30, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.025em", margin: "0 0 8px 0" }}>
        Create an Account
      </h1>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", margin: "0 0 28px 0", lineHeight: 1.6 }}>
        Join SpeakArena and start your English fluency journey today.
      </p>

      {/* Error banner */}
      {serverError && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
          <AlertCircle style={{ width: 16, height: 16, color: "#f87171", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#f87171" }}>{serverError}</span>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>

          {/* ── Full Name ── */}
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 6 }}>Full Name</label>
                <FormControl>
                  <div style={inputWrapStyle(focused === "fullName")}>
                    <span style={{ position: "absolute", left: 14, color: "rgba(255,255,255,0.4)", display: "flex" }}><UserIcon /></span>
                    <input type="text" placeholder="Jane Doe" disabled={isLoading} style={nativeInputStyle} {...field} onFocus={() => setFocused("fullName")} onBlur={() => setFocused(null)} />
                  </div>
                </FormControl>
                <FormMessage style={{ fontSize: 12, color: "#f87171", marginTop: 4 }} />
              </FormItem>
            )}
          />

          {/* ── Email ── */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 6 }}>Email</label>
                <FormControl>
                  <div style={inputWrapStyle(focused === "email")}>
                    <span style={{ position: "absolute", left: 14, color: "rgba(255,255,255,0.4)", display: "flex" }}><MailIcon /></span>
                    <input type="email" placeholder="name@example.com" disabled={isLoading} style={nativeInputStyle} {...field} onFocus={() => setFocused("email")} onBlur={() => setFocused(null)} />
                  </div>
                </FormControl>
                <FormMessage style={{ fontSize: 12, color: "#f87171", marginTop: 4 }} />
              </FormItem>
            )}
          />

          {/* ── Password ── */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem style={{ marginBottom: 6 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 6 }}>Password</label>
                <FormControl>
                  <div style={inputWrapStyle(focused === "password")}>
                    <span style={{ position: "absolute", left: 14, color: "rgba(255,255,255,0.4)", display: "flex" }}><LockIcon /></span>
                    <input type={showPassword ? "text" : "password"} placeholder="Create a strong password" disabled={isLoading} style={{ ...nativeInputStyle, paddingRight: 44 }} {...field} onFocus={() => setFocused("password")} onBlur={() => setFocused(null)} />
                    <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: "absolute", right: 14, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex", padding: 0 }}>
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </FormControl>
                <PasswordStrengthIndicator password={passwordValue} showChecklist={true} />
                <FormMessage style={{ fontSize: 12, color: "#f87171", marginTop: 4 }} />
              </FormItem>
            )}
          />

          {/* ── Confirm Password ── */}
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 6 }}>Confirm Password</label>
                <FormControl>
                  <div style={inputWrapStyle(focused === "confirmPassword")}>
                    <span style={{ position: "absolute", left: 14, color: "rgba(255,255,255,0.4)", display: "flex" }}><LockIcon /></span>
                    <input type="password" placeholder="Repeat your password" disabled={isLoading} style={nativeInputStyle} {...field} onFocus={() => setFocused("confirmPassword")} onBlur={() => setFocused(null)} />
                  </div>
                </FormControl>
                <FormMessage style={{ fontSize: 12, color: "#f87171", marginTop: 4 }} />
              </FormItem>
            )}
          />

          {/* ── Primary CTA ── */}
          <button
            type="submit"
            disabled={isLoading}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 46, borderRadius: 10, background: "linear-gradient(135deg, #4f46e5, #7c3aed)", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.7 : 1 }}
          >
            {isLoading && <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />}
            {isLoading ? "Creating Account…" : "Create account"}
          </button>
        </form>
      </Form>

      {/* ── Footer ── */}
      <p style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 20 }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "#818cf8", fontWeight: 700, textDecoration: "none" }}>
          Sign In
        </Link>
      </p>

      {/* ── Terms ── */}
      <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 10, lineHeight: 1.6 }}>
        By creating an account, you agree to our{" "}
        <Link href="/terms" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "underline" }}>Terms of Service</Link>
        {" "}and{" "}
        <Link href="/privacy" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "underline" }}>Privacy Policy</Link>.
      </p>
    </div>
  );
}
