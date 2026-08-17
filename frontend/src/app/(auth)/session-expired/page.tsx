import Link from "next/link";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

export default function SessionExpiredPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      <div className="grid-bg absolute inset-0 opacity-40 pointer-events-none" />
      <div className="glow-indigo absolute" style={{ width: 400, height: 400, top: -100, left: "50%", transform: "translateX(-50%)" }} />

      <div className="card-glass max-w-md w-full p-8 sm:p-10 relative z-10 text-center sm:text-left">
        <div className="mx-auto sm:mx-0 flex h-16 w-16 items-center justify-center rounded-full mb-8 bg-amber-500/10">
          <Clock className="h-8 w-8 text-amber-500" />
        </div>
        
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Session expired</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          For your security, your session has expired due to inactivity. Please sign in again to continue.
        </p>

        <div className="mt-10">
          <Button asChild className="btn-primary w-full h-11 press-scale">
            <Link href={ROUTES.LOGIN} className="flex items-center justify-center">
              Sign in again
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
