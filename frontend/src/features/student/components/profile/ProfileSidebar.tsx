"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Mail, Globe, MapPin, Clock, ShieldCheck, Smartphone, History } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";

export function ProfileSidebar() {
  const { user } = useAuthStore();

  return (
    <div className="w-full lg:w-80 shrink-0 space-y-6">

      {/* About Me */}
      <div className="card-glass p-5 hover-lift">
        <h3 className="text-sm font-bold mb-4 text-foreground">About Me</h3>
        <p className="text-sm leading-relaxed mb-6 text-muted-foreground">
          &ldquo;I am a lifelong learner focusing on improving my skills through Speak Arena.&rdquo;
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Mail className="h-4 w-4 text-primary" />
            <span className="truncate">{user?.email || "No email"}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            <span>Global</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Globe className="h-4 w-4 text-primary" />
            <span>English</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-primary" />
            <span>UTC</span>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border/50">
          <h4 className="text-xs font-bold uppercase tracking-wider mb-3 text-muted-foreground">Interests</h4>
          <div className="flex flex-wrap gap-2">
            {["Technology", "Design", "Business"].map(interest => (
              <Badge
                key={interest}
                variant="secondary"
                className="font-medium bg-white/5 border border-white/10 text-foreground"
              >
                {interest}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Security Summary */}
      <div className="card-glass p-5 hover-lift">
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-400" /> Security
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Email Verified</span>
            {user?.isVerified ? (
              <Badge className="shadow-none bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">Yes</Badge>
            ) : (
              <Badge className="shadow-none bg-destructive/15 border border-destructive/30 text-destructive">No</Badge>
            )}
          </div>
          <div className="flex items-start justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <History className="h-3.5 w-3.5" /> Last Login
            </span>
            <span className="font-medium text-right text-foreground">Just now</span>
          </div>
          <div className="flex items-start justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Smartphone className="h-3.5 w-3.5" /> Active Sessions
            </span>
            <span className="font-medium text-foreground">1 device</span>
          </div>
        </div>
      </div>

    </div>
  );
}
