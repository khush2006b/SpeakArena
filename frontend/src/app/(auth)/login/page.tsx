import { Metadata } from "next";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { LoginForm } from "@/features/auth/components/LoginForm";

export const metadata: Metadata = {
  title: "Login - SpeakArena",
  description: "Sign in to your SpeakArena account.",
};

export default function LoginPage() {
  return (
    <AuthLayout 
      quote="Education is the passport to the future, for tomorrow belongs to those who prepare for it today."
      author="Malcolm X"
    >
      <LoginForm />
    </AuthLayout>
  );
}
