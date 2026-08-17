"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { useResetPassword } from "@/hooks/queries/useAuthQueries";
import { getErrorMessage, isValidationError, mapServerErrorsToForm } from "@/utils/errorHandler";
import { resetPasswordSchema, type ResetPasswordValues } from "../schemas/auth.schemas";
import { PasswordStrengthIndicator } from "./PasswordStrengthIndicator";

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [focusedField, setFocusedField] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const resetMutation = useResetPassword();

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  
  const passwordValue = form.watch("password");

  async function onSubmit(data: ResetPasswordValues) {
    try {
      await resetMutation.mutateAsync({ token, newPassword: data.password });
      setIsSuccess(true);
    } catch (error) {
      if (isValidationError(error)) {
        mapServerErrorsToForm(error, form.setError as Parameters<typeof mapServerErrorsToForm>[1]);
      }
    }
  }

  const cardStyle: React.CSSProperties = {
    background: "rgba(15, 22, 36, 0.75)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
    padding: "36px",
    boxShadow: "0 20px 50px rgba(0, 0, 0, 0.4)",
  };

  const headingStyle: React.CSSProperties = {
    color: "#ffffff",
    fontWeight: 900,
    letterSpacing: "-0.03em",
    fontSize: "28px",
    marginBottom: "6px",
  };

  const getWrapperStyle = (fieldName: string): React.CSSProperties => ({
    background: "rgba(255, 255, 255, 0.04)",
    border: focusedField === fieldName ? "1px solid #6366f1" : "1px solid rgba(255, 255, 255, 0.08)",
    boxShadow: focusedField === fieldName ? "0 0 0 3px rgba(99, 102, 241, 0.2)" : "none",
    borderRadius: 12,
    position: "relative",
    display: "flex",
    alignItems: "center",
    transition: "all 0.2s ease",
  });

  const inputStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    color: "#ffffff",
    width: "100%",
    paddingLeft: "40px",
    height: "46px",
    outline: "none",
    boxShadow: "none",
    fontSize: "14px",
  };

  const labelStyle: React.CSSProperties = {
    color: "#f1f5f9",
    fontWeight: 600,
    fontSize: "13px",
  };

  const buttonPrimaryStyle: React.CSSProperties = {
    background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
    color: "#ffffff",
    borderRadius: 12,
    fontWeight: 700,
    height: "46px",
    width: "100%",
    border: "none",
    fontSize: "15px",
    boxShadow: "0 4px 15px rgba(79, 70, 229, 0.35)",
    cursor: "pointer",
  };

  if (isSuccess) {
    return (
      <div style={cardStyle} className="space-y-6 text-center">
        <div className="flex justify-center">
          <div style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", borderRadius: "50%", width: "64px", height: "64px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle2 className="h-8 w-8" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 style={headingStyle}>
            Password updated
          </h1>
          <p style={{ color: "#9ca3af", lineHeight: 1.7 }}>
            Your password has been reset. You can now sign in with your new password.
          </p>
        </div>
        <Button asChild style={{...buttonPrimaryStyle, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none"}}>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  const isLoading = resetMutation.isPending;
  const serverError =
    !isValidationError(resetMutation.error) && resetMutation.error
      ? getErrorMessage(resetMutation.error)
      : null;

  return (
    <div style={cardStyle}>
      <div className="space-y-2 text-center lg:text-left mb-6">
        <h1 style={headingStyle}>
          Set new password
        </h1>
        <p style={{ color: "#9ca3af", lineHeight: 1.7 }}>
          Choose a strong password for your account.
        </p>
      </div>

      {serverError && (
        <Alert variant="destructive" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid #ef4444", color: "#ef4444", marginBottom: "24px" }}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel style={labelStyle}>New password</FormLabel>
                <FormControl>
                  <div style={getWrapperStyle("password")}>
                    <Lock className="absolute left-3 h-4 w-4" style={{ color: "#6b7280" }} />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      style={{ ...inputStyle, paddingRight: "36px" }}
                      disabled={isLoading}
                      autoComplete="new-password"
                      {...field}
                      onFocus={() => setFocusedField("password")}
                      onBlur={() => setFocusedField(null)}
                    />
                    <button
                      type="button"
                      className="absolute right-3"
                      style={{ color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <PasswordStrengthIndicator password={passwordValue} showChecklist={true} />
                <FormMessage style={{ color: "#ef4444" }} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel style={labelStyle}>Confirm password</FormLabel>
                <FormControl>
                  <div style={getWrapperStyle("confirmPassword")}>
                    <Lock className="absolute left-3 h-4 w-4" style={{ color: "#6b7280" }} />
                    <Input
                      type="password"
                      placeholder="Repeat your password"
                      style={inputStyle}
                      disabled={isLoading}
                      autoComplete="new-password"
                      {...field}
                      onFocus={() => setFocusedField("confirmPassword")}
                      onBlur={() => setFocusedField(null)}
                    />
                  </div>
                </FormControl>
                <FormMessage style={{ color: "#ef4444" }} />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            style={{ ...buttonPrimaryStyle, marginTop: "24px" }}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Resetting password…" : "Reset password"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
