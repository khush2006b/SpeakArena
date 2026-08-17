"use client";

import * as React from "react";
import { Save, Loader2, Mail, Smartphone, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSettingsStore } from "@/stores/settings.store";
import { toast } from "sonner";
import { apiClient } from "@/services/api/client";
export function NotificationSettings() {
  const { isSaving, setIsSaving } = useSettingsStore();
  const [emailSettings, setEmailSettings] = React.useState<any>({});
  const [pushSettings, setPushSettings] = React.useState<any>({});
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await apiClient.get("/api/v1/teacher/profile");
        setEmailSettings(response.data?.notifications?.email || {});
        setPushSettings(response.data?.notifications?.push || {});
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiClient.patch("/api/v1/teacher/profile", {
        notifications: {
          email: emailSettings,
          push: pushSettings
        }
      });
      toast.success("Notifications saved successfully");
    } catch (error) {
      toast.error("Failed to save notifications");
    } finally {
      setIsSaving(false);
    }
  };
  const categories = [
    { id: "studentEnrollment", label: "Student Enrollments", desc: "When a new student joins your course." },
    { id: "payments", label: "Payments & Invoices", desc: "Successful payments and payout reports." },
    { id: "refunds", label: "Refund Requests", desc: "When a student requests or is issued a refund." },
    { id: "chat", label: "Direct Messages", desc: "When a student sends you a private message." },
    { id: "announcements", label: "Platform Announcements", desc: "Updates from the SpeakArena team." },
  ];

  return (
    <div className="space-y-8 animate-fade-up relative pb-24">
      <div>
        <h2 className="text-responsive-lg font-extrabold tracking-tight text-foreground">Notifications</h2>
        <p className="text-[15px] font-semibold text-muted-foreground mt-2">Configure how and when you receive platform alerts.</p>
      </div>

      <div className="card-glass p-6 sm:p-8 relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-background/50 flex items-center justify-center backdrop-blur-sm rounded-2xl">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <div className="mb-8 border-b border-border/40 pb-6">
          <h3 className="text-xl font-extrabold tracking-tight flex items-center gap-3 text-foreground">
            <BellRing className="h-5 w-5 text-violet-400" />
            Routing Preferences
          </h3>
          <p className="text-sm font-semibold text-muted-foreground mt-2">Choose which events trigger an email or browser push notification.</p>
        </div>
        <div className="space-y-4">

          {/* Headers */}
          <div className="hidden sm:grid grid-cols-12 gap-4 pb-4 border-b border-border/40 px-4">
            <div className="col-span-8"></div>
            <div className="col-span-2 text-center">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</span>
            </div>
            <div className="col-span-2 text-center">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-1.5"><Smartphone className="h-3.5 w-3.5" /> Push</span>
            </div>
          </div>

          {/* Rows */}
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center p-4 rounded-2xl bg-card/30 border border-transparent hover:border-border/40 hover:bg-card/50 transition-all duration-300 group">
                <div className="sm:col-span-8 space-y-1">
                  <h4 className="text-[15px] font-extrabold text-foreground group-hover:text-violet-400 transition-colors">{cat.label}</h4>
                  <p className="text-[13px] font-medium text-muted-foreground">{cat.desc}</p>
                </div>
                <div className="sm:col-span-2 flex justify-start sm:justify-center mt-3 sm:mt-0">
                  <Switch
                    checked={(emailSettings as any)[cat.id]}
                    onCheckedChange={(val) => setEmailSettings((s: any) => ({...s, [cat.id]: val}))}
                    className="data-[state=checked]:bg-violet-500"
                  />
                </div>
                <div className="sm:col-span-2 flex justify-start sm:justify-center mt-3 sm:mt-0">
                  <Switch
                    checked={(pushSettings as any)[cat.id]}
                    onCheckedChange={(val) => setPushSettings((s: any) => ({...s, [cat.id]: val}))}
                    className="data-[state=checked]:bg-violet-500"
                  />
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      <div className="fixed bottom-8 right-8 z-40 p-4 bg-card/95 backdrop-blur-3xl border border-border/50 rounded-2xl shadow-2xl">
        <Button onClick={handleSave} disabled={isSaving} className="btn-primary w-full sm:w-auto h-12 px-8 rounded-xl press-scale">
          {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
