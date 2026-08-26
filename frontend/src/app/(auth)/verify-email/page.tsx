"use client";

import React from "react";
import Link from "next/link";
import { Mail, RefreshCw, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ROUTES } from "@/constants/routes";
import { useForgotPassword } from "@/hooks/queries/useAuthQueries";
import { getErrorMessage } from "@/utils/errorHandler";

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const resolvedParams = React.use(searchParams);
  const email = resolvedParams.email ?? "";
  const resendMutation = useForgotPassword();
  const [resent, setResent] = React.useState(false);

  async function handleResend() {
    if (!email) return;
    try {
      await resendMutation.mutateAsync(email);
      setResent(true);
    } catch {
      // error shown below
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      <div className="grid-bg absolute inset-0 opacity-40 pointer-events-none" />
      <div className="glow-indigo absolute" style={{ width: 400, height: 400, top: -100, left: "50%", transform: "translateX(-50%)" }} />

      <div className="card-glass max-w-md w-full p-8 sm:p-10 relative z-10 text-center sm:text-left">
        <div className="mx-auto sm:mx-0 flex h-16 w-16 items-center justify-center rounded-full mb-8 bg-primary/10">
          <Mail className="h-8 w-8 text-primary" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Verify your email
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          We&apos;ve sent a verification link to{" "}
          {email ? (
            <span className="text-foreground font-semibold">{email}</span>
          ) : (
            "your email address"
          )}
          . Click the link to activate your account.
        </p>

        {resent && (
          <div className="mt-6 flex items-center gap-2 text-sm text-emerald-500">
            <CheckCircle2 className="h-4 w-4" />
            Verification email resent successfully.
          </div>
        )}

        {resendMutation.error && !resent && (
          <Alert variant="destructive" className="mt-6 bg-destructive/10 border-destructive text-destructive">
            <AlertDescription>
              {getErrorMessage(resendMutation.error)}
            </AlertDescription>
          </Alert>
        )}

        <div className="mt-10 space-y-4">
          <Button
            className="btn-primary w-full h-11 press-scale"
            onClick={handleResend}
            disabled={resendMutation.isPending || !email || resent}
          >
            {resendMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Resend verification email
              </>
            )}
          </Button>

          <Button variant="outline" asChild className="btn-ghost w-full h-11 press-scale">
            <Link href={ROUTES.LOGIN} className="flex items-center justify-center">Back to sign in</Link>
          </Button>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Didn&apos;t receive the email? Check your spam folder or{" "}
          <a
            href="mailto:speakarena8@gmail.com"
            className="text-primary font-semibold hover:underline"
          >
            contact support
          </a>
          .
        </p>
      </div>
    </div>
  );
}
