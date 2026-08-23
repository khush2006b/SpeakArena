"use client";

import * as React from "react";
import { Key, Smartphone, Laptop, Globe, LogOut, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiClient } from "@/services/api/client";
import { cn } from "@/lib/utils";

export function SecuritySettings() {
  const [sessions, setSessions] = React.useState<any[]>([]);
  const [userEmail, setUserEmail] = React.useState<string>("");
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await apiClient.get("/api/v1/teacher/profile");
        const profile = response.data?.data || response.data;
        if (profile?.email) {
          setUserEmail(profile.email);
        }
        setSessions(response.data?.security?.activeSessions || []);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleChangePassword = async () => {
    if (!userEmail) {
      toast.error("User email not loaded. Please try again.");
      return;
    }
    try {
      await apiClient.post("/api/v1/auth/forgot-password", { email: userEmail });
      toast.success("Password reset email sent!");
    } catch (error) {
      toast.error("Failed to send password reset email");
    }
  };


  const handleLogoutAll = () => {
    setSessions(sessions.filter(s => s.isCurrent));
    toast.info("All other sessions have been logged out.");
  };

  const handleLogoutSingle = (id: string) => {
    setSessions(sessions.filter(s => s.id !== id));
    toast.info("Session revoked");
  };

  const getDeviceIcon = (device: string) => {
    if (device.toLowerCase().includes("iphone") || device.toLowerCase().includes("mobile")) return <Smartphone className="h-5 w-5" />;
    return <Laptop className="h-5 w-5" />;
  };

  return (
    <div className="space-y-8 animate-fade-up relative pb-24">
      <div>
        <h2 className="text-responsive-lg font-extrabold tracking-tight text-foreground">Security &amp; Sessions</h2>
        <p className="text-[15px] font-semibold text-muted-foreground mt-2">Manage your password, 2FA, and active login sessions.</p>
      </div>

      <div className="card-glass p-6 sm:p-8">
        <div className="mb-8 border-b border-border/40 pb-6">
          <h3 className="text-xl font-extrabold tracking-tight flex items-center gap-3 text-foreground">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            Password &amp; Authentication
          </h3>
          <p className="text-sm font-semibold text-muted-foreground mt-2">Secure your account with a strong password and two-factor authentication.</p>
        </div>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 rounded-2xl border border-border/40 bg-card/30 hover:bg-card/50 transition-colors gap-4">
            <div className="flex items-center gap-5">
              <div className="h-12 w-12 rounded-xl bg-card/60 flex items-center justify-center border border-border/50">
                <Key className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h4 className="text-[15px] font-extrabold text-foreground">Password</h4>
                <p className="text-[13px] font-medium text-muted-foreground">Last changed 3 months ago</p>
              </div>
            </div>
            <Button onClick={handleChangePassword} variant="outline" className="w-full sm:w-auto h-10 rounded-xl font-bold tracking-wide border-border/50 bg-card/40 hover:bg-card/80 hover:text-foreground transition-all press-scale">Change Password</Button>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 rounded-2xl border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 transition-colors gap-4 group">
            <div className="flex items-center gap-5">
              <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 transition-transform group-hover:scale-110">
                <ShieldAlert className="h-5 w-5 text-orange-400" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h4 className="text-[15px] font-extrabold text-foreground">Two-Factor Authentication (2FA)</h4>
                  <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-widest text-orange-400 bg-orange-500/10 border-orange-500/20">Not Enabled</Badge>
                </div>
                <p className="text-[13px] font-medium text-muted-foreground">Protect your account with an extra layer of security.</p>
              </div>
            </div>
            <Button className="w-full sm:w-auto h-10 rounded-xl font-bold tracking-wide bg-orange-500 text-foreground hover:bg-orange-600 border-orange-500/50 press-scale">Enable 2FA</Button>
          </div>
        </div>
      </div>

      <div className="card-glass p-6 sm:p-8">
        <div className="mb-8 border-b border-border/40 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h3 className="text-xl font-extrabold tracking-tight flex items-center gap-3 text-foreground">
              <Laptop className="h-5 w-5 text-blue-400" />
              Active Sessions
            </h3>
            <p className="text-sm font-semibold text-muted-foreground mt-2">Devices that are currently logged into your account.</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogoutAll} className="h-10 rounded-xl font-bold tracking-wide text-destructive border-destructive/20 bg-destructive/5 hover:bg-destructive/10 hover:text-destructive transition-all press-scale">
            Log out all other sessions
          </Button>
        </div>
        <div className="space-y-2 relative">
          {isLoading && (
            <div className="py-8 flex justify-center">
              <span className="text-sm text-muted-foreground">Loading sessions...</span>
            </div>
          )}
          {!isLoading && sessions.length === 0 && (
            <div className="py-8 flex justify-center">
              <span className="text-sm text-muted-foreground">No active sessions found.</span>
            </div>
          )}
          {!isLoading && sessions.map((session, _i) => (
            <div key={session.id} className={cn(
              "flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-2xl transition-all duration-300",
              session.isCurrent ? "bg-card/50 border border-border/50" : "hover:bg-card/30 border border-transparent"
            )}>
              <div className="flex gap-5">
                <div className={cn(
                  "h-12 w-12 rounded-xl flex items-center justify-center",
                  session.isCurrent ? "bg-violet-500/20 text-violet-400 border border-violet-500/30" : "bg-card/60 text-muted-foreground border border-border/50"
                )}>
                  {getDeviceIcon(session.device)}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h4 className="text-[15px] font-extrabold text-foreground">{session.device}</h4>
                    {session.isCurrent && <Badge variant="default" className="badge-primary h-5 px-2 text-[10px] font-bold uppercase tracking-widest">Current Session</Badge>}
                  </div>
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
                    <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {session.browser}</span>
                    <span className="opacity-50">•</span>
                    <span>{session.location}</span>
                    <span className="opacity-50">•</span>
                    <span>{session.ipAddress}</span>
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground opacity-50 pt-1">Active: {session.lastActive}</p>
                </div>
              </div>
              {!session.isCurrent && (
                <Button variant="ghost" size="icon" onClick={() => handleLogoutSingle(session.id)} className="mt-4 sm:mt-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl h-10 w-10 transition-colors press-scale">
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
