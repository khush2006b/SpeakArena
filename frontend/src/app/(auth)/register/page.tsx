import { Metadata } from "next";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export const metadata: Metadata = {
  title: "Create Account - SpeakArena",
  description: "Join SpeakArena and start your English fluency journey.",
};

export default function RegisterPage() {
  return (
    <AuthLayout 
      quote="The beautiful thing about learning is that no one can take it away from you."
      author="B.B. King"
    >
      <RegisterForm />
    </AuthLayout>
  );
}
