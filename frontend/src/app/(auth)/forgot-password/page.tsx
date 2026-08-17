import { Metadata } from "next";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot Password - SpeakArena",
  description: "Reset your SpeakArena password.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthLayout 
      quote="Success is no accident. It is hard work, perseverance, learning, studying, sacrifice and most of all, love of what you are doing."
      author="Pelé"
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
