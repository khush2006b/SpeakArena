import { Metadata } from "next";
import { ProfileContent } from "@/features/teacher/components/profile/ProfileContent";

export const metadata: Metadata = {
  title: "Professional Profile",
  description: "Enterprise teacher identity and professional profile.",
};

export default function ProfilePage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 pb-24 min-h-screen">
      
      {/* Top Header Placeholder (Preview Toggle) */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Profile & Identity</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your professional presence and public appearance.</p>
        </div>
        <div>
          {/* We could mount a client-side Preview Toggle here */}
        </div>
      </div>

      <ProfileContent />
    </div>
  );
}
