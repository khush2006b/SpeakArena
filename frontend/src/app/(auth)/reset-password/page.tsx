import { Metadata } from "next";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { ResetPasswordClientPage } from "@/features/auth/components/ResetPasswordClientPage";

export const metadata: Metadata = {
  title: "Reset Password - SpeakArena",
  description: "Set a new password for your SpeakArena account.",
};

/**
 * Reset Password Page
 *
 * The token is extracted from the URL search params (?token=...) and
 * passed to the client component for use in the mutation.
 * If no token is present, a friendly invalid-link state is shown.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const resolvedParams = await searchParams;
  return (
    <AuthLayout
      quote="A smooth sea never made a skilled sailor."
      author="Franklin D. Roosevelt"
    >
      <ResetPasswordClientPage token={resolvedParams.token ?? ""} />
    </AuthLayout>
  );
}
