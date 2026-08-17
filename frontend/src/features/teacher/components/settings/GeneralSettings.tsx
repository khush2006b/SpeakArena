"use client";

import * as React from "react";
import { Save, Loader2, Globe, Clock, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/stores/settings.store";
import { useNotificationsStore } from "@/stores/notifications.store";

const selectClass = "appearance-none flex h-12 w-full items-center justify-between rounded-xl border border-border/50 bg-card/50 px-4 py-2 text-[15px] font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50 hover:bg-card/80 transition-all cursor-pointer";

export function GeneralSettings() {
  const { isSaving, setIsSaving } = useSettingsStore();
  const { addToast } = useNotificationsStore();

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 800));
    addToast({ title: "Settings Saved", description: "General preferences have been updated.", variant: "success" });
    setIsSaving(false);
  };

  return (
    <div className="space-y-8 animate-fade-up relative pb-24">
      <div>
        <h2 className="text-responsive-lg font-extrabold tracking-tight text-foreground">General Settings</h2>
        <p className="text-[15px] font-semibold text-muted-foreground mt-2">Manage your basic platform preferences and localizations.</p>
      </div>

      <div className="card-glass p-6 sm:p-8">
        <div className="mb-8 border-b border-border/40 pb-6">
          <h3 className="text-xl font-extrabold tracking-tight text-foreground">Localization</h3>
          <p className="text-sm font-semibold text-muted-foreground mt-2">Configure language, timezone, and regional formatting.</p>
        </div>
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-xs font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                <Globe className="h-4 w-4 text-violet-400" /> Platform Language
              </label>
              <div className="relative">
                <select className={selectClass}>
                  <option value="en-US" className="bg-card text-foreground">English (US)</option>
                  <option value="es-ES" className="bg-card text-foreground">Spanish</option>
                  <option value="fr-FR" className="bg-card text-foreground">French</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-muted-foreground">
                  <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-xs font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-400" /> Timezone
              </label>
              <div className="relative">
                <select className={selectClass}>
                  <option value="America/Los_Angeles" className="bg-card text-foreground">Pacific Time (PT)</option>
                  <option value="America/New_York" className="bg-card text-foreground">Eastern Time (ET)</option>
                  <option value="Europe/London" className="bg-card text-foreground">Greenwich Mean Time (GMT)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-muted-foreground">
                  <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card-glass p-6 sm:p-8">
        <div className="mb-8 border-b border-border/40 pb-6">
          <h3 className="text-xl font-extrabold tracking-tight text-foreground">Formatting Defaults</h3>
          <p className="text-sm font-semibold text-muted-foreground mt-2">How dates and currency should be presented.</p>
        </div>
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-xs font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4 text-violet-400" /> Date Format
              </label>
              <div className="relative">
                <select className={selectClass}>
                  <option value="MM/DD/YYYY" className="bg-card text-foreground">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY" className="bg-card text-foreground">DD/MM/YYYY</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-muted-foreground">
                  <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-xs font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-400" /> Currency Display
              </label>
              <div className="relative">
                <select className={selectClass}>
                  <option value="USD" className="bg-card text-foreground">USD ($)</option>
                  <option value="EUR" className="bg-card text-foreground">EUR (€)</option>
                  <option value="GBP" className="bg-card text-foreground">GBP (£)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-muted-foreground">
                  <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            </div>
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
