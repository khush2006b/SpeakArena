"use client";

import * as React from "react";
import { Monitor, Moon, Sun, Save, Loader2, Sparkles, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSettingsStore } from "@/stores/settings.store";
import { useNotificationsStore } from "@/stores/notifications.store";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function AppearanceSettings() {
  const { isSaving, setIsSaving } = useSettingsStore();
  const { addToast } = useNotificationsStore();
  const { theme, setTheme } = useTheme();
  const [animations, setAnimations] = React.useState(true);

  const handleSave = async () => {
    setIsSaving(true);
    addToast({ title: "Appearance Saved", description: "Your visual preferences have been updated.", variant: "success" });
    setIsSaving(false);
  };

  return (
    <div className="space-y-8 animate-fade-up relative pb-24">
      <div>
        <h2 className="text-responsive-lg font-extrabold tracking-tight text-foreground">Appearance</h2>
        <p className="text-[15px] font-semibold text-muted-foreground mt-2">Customize how SpeakArena looks and feels on your device.</p>
      </div>

      <div className="card-glass p-6 sm:p-8">
        <div className="mb-8 border-b border-border/40 pb-6">
          <h3 className="text-xl font-extrabold tracking-tight flex items-center gap-3 text-foreground">
            <Sparkles className="h-5 w-5 text-yellow-400" />
            Theme Preferences
          </h3>
          <p className="text-sm font-semibold text-muted-foreground mt-2">Select a theme or sync with your system preferences.</p>
        </div>
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-1 gap-6 max-w-sm">

            <div
              className="group flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-violet-500 bg-violet-500/5 cursor-default"
            >
              <div className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg bg-slate-900 border-2 border-violet-500/50">
                <Moon className="h-8 w-8 text-violet-400" />
              </div>
              <span className="text-[15px] font-bold tracking-wide text-violet-400">Dark Mode (Default & Active)</span>
              <p className="text-xs text-muted-foreground mt-1 font-medium">SpeakArena is exclusively crafted for Dark Mode</p>
            </div>

          </div>
        </div>
      </div>

      <div className="card-glass p-6 sm:p-8">
        <div className="mb-8 border-b border-border/40 pb-6">
          <h3 className="text-xl font-extrabold tracking-tight flex items-center gap-3 text-foreground">
            <Activity className="h-5 w-5 text-blue-400" />
            Motion &amp; Accessibility
          </h3>
          <p className="text-sm font-semibold text-muted-foreground mt-2">Configure interface animations and transitions.</p>
        </div>
        <div className="space-y-6">
          <div className="flex items-center justify-between p-6 rounded-2xl border border-border/40 bg-card/30 hover:bg-card/50 transition-colors">
            <div className="space-y-1.5">
              <h4 className="text-[15px] font-extrabold text-foreground">Enable Animations</h4>
              <p className="text-sm font-medium text-muted-foreground">Turn off UI animations for a reduced-motion experience.</p>
            </div>
            <Switch checked={animations} onCheckedChange={setAnimations} className="data-[state=checked]:bg-violet-500" />
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
