"use client";

import * as React from "react";
import { Monitor, Moon, Sun, Save, Loader2, Sparkles, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSettingsStore } from "@/stores/settings.store";
import { useNotificationsStore } from "@/stores/notifications.store";
import { cn } from "@/lib/utils";

export function AppearanceSettings() {
  const { isSaving, setIsSaving } = useSettingsStore();
  const { addToast } = useNotificationsStore();
  const [theme, setTheme] = React.useState("system");
  const [animations, setAnimations] = React.useState(true);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 800));
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

            <button
              onClick={() => setTheme("light")}
              className={cn("group flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 hover-lift press-scale",
                theme === "light" ? "border-violet-500 bg-violet-500/5" : "border-border/40 bg-card/30 hover:bg-card/60 hover:border-border/60"
              )}
            >
              <div className={cn("h-16 w-16 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-500 group-hover:scale-110 shadow-lg",
                theme === "light" ? "bg-white border-2 border-violet-500/20" : "bg-slate-100 border border-slate-200"
              )}>
                <Sun className={cn("h-8 w-8", theme === "light" ? "text-violet-500" : "text-slate-500")} />
              </div>
              <span className={cn("text-[15px] font-bold tracking-wide", theme === "light" ? "text-violet-400" : "text-muted-foreground group-hover:text-foreground")}>Light</span>
            </button>

            <button
              onClick={() => setTheme("dark")}
              className={cn("group flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 hover-lift press-scale",
                theme === "dark" ? "border-violet-500 bg-violet-500/5" : "border-border/40 bg-card/30 hover:bg-card/60 hover:border-border/60"
              )}
            >
              <div className={cn("h-16 w-16 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-500 group-hover:scale-110 shadow-lg bg-slate-900",
                theme === "dark" ? "border-2 border-violet-500/50" : "border border-slate-800"
              )}>
                <Moon className={cn("h-8 w-8", theme === "dark" ? "text-violet-400" : "text-slate-400")} />
              </div>
              <span className={cn("text-[15px] font-bold tracking-wide", theme === "dark" ? "text-violet-400" : "text-muted-foreground group-hover:text-foreground")}>Dark</span>
            </button>

            <button
              onClick={() => setTheme("system")}
              className={cn("group flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 hover-lift press-scale",
                theme === "system" ? "border-violet-500 bg-violet-500/5" : "border-border/40 bg-card/30 hover:bg-card/60 hover:border-border/60"
              )}
            >
              <div className={cn("h-16 w-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-800 flex items-center justify-center mb-4 transition-transform duration-500 group-hover:scale-110 shadow-lg",
                theme === "system" ? "border-2 border-violet-500/50" : "border border-slate-700"
              )}>
                <Monitor className={cn("h-8 w-8", theme === "system" ? "text-foreground" : "text-slate-300")} />
              </div>
              <span className={cn("text-[15px] font-bold tracking-wide", theme === "system" ? "text-violet-400" : "text-muted-foreground group-hover:text-foreground")}>System Sync</span>
            </button>

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
