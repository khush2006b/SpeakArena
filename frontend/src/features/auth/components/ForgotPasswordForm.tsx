"use client";

import * as React from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

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

import { useForgotPassword } from "@/hooks/queries/useAuthQueries";
import { getErrorMessage } from "@/utils/errorHandler";
import { forgotPasswordSchema, type ForgotPasswordValues } from "../schemas/auth.schemas";

export function ForgotPasswordForm() {
  const [submittedEmail, setSubmittedEmail] = React.useState<string | null>(null);
  const [focusedField, setFocusedField] = React.useState<string | null>(null);
  const forgotPasswordMutation = useForgotPassword();

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(data: ForgotPasswordValues) {
    try {
      await forgotPasswordMutation.mutateAsync(data.email);
      setSubmittedEmail(data.email);
    } catch {
      // Error shown via mutation.error
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (submittedEmail) {
    return (
      <div className="card-glass p-8 sm:p-10 space-y-6 text-center w-full max-w-md mx-auto relative z-10">
        <div className="flex justify-center">
          <div className="bg-emerald-500/15 text-emerald-500 rounded-full w-16 h-16 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-foreground mb-2">
            Check your email
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">
            We&apos;ve sent a reset link to{" "}
            <span className="text-foreground font-semibold">{submittedEmail}</span>.
            It expires in 15 minutes.
          </p>
        </div>
        <p className="text-muted-foreground text-sm">
          Didn&apos;t receive it?{" "}
          <button
            type="button"
            onClick={() => {
              setSubmittedEmail(null);
              forgotPasswordMutation.reset();
            }}
            className="text-primary font-semibold bg-transparent border-none cursor-pointer hover:underline"
          >
            Try again
          </button>
        </p>
        <Button asChild variant="outline" className="btn-ghost w-full h-11 press-scale">
          <Link href="/login" className="flex items-center justify-center">Return to sign in</Link>
        </Button>
      </div>
    );
  }

  const isLoading = forgotPasswordMutation.isPending;
  const serverError = forgotPasswordMutation.error
    ? getErrorMessage(forgotPasswordMutation.error)
    : null;

  return (
    <div className="card-glass p-8 sm:p-10 w-full max-w-md mx-auto relative z-10">
      <div className="space-y-2 text-center lg:text-left mb-6">
        <Link
          href="/login"
          className="inline-flex items-center text-sm font-medium text-muted-foreground mb-4 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to sign in
        </Link>
        <h1 className="text-3xl font-black tracking-tight text-foreground mb-2">
          Forgot password?
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Enter your email and we&apos;ll send you reset instructions.
        </p>
      </div>

      {serverError && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive text-destructive mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-foreground font-semibold text-sm">Email address</FormLabel>
                <FormControl>
                  <div className={`relative flex items-center rounded-xl bg-background/50 border transition-all duration-200 ${focusedField === 'email' ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
                    <Mail className="absolute left-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="name@example.com"
                      className="bg-transparent border-none text-foreground w-full pl-10 h-11 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50"
                      disabled={isLoading}
                      autoComplete="email"
                      {...field}
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => setFocusedField(null)}
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-destructive" />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="btn-primary w-full h-11 press-scale"
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Sending reset link…" : "Send reset link"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
