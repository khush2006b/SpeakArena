"use client";

import * as React from "react";
import { useStudentSettingsStore } from "@/stores/student-settings.store";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";

export function AccessibilitySettings() {
  const { reducedMotion, highContrast, largeText, updateSetting } = useStudentSettingsStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="page-title">Accessibility</h2>
        <p className="page-subtitle">Make the platform easier to use for your specific needs.</p>
      </div>

      <div className="card-glass overflow-hidden flex flex-col">

        {/* Reduced Motion */}
        <div className="flex items-center justify-between p-6 border-b border-border/50 gap-4 flex-wrap">
          <div className="flex flex-col gap-1 pr-4">
            <Label className="text-base font-extrabold text-foreground">Reduced Motion</Label>
            <p className="text-sm text-muted-foreground m-0">Minimize UI animations and page transitions.</p>
          </div>
          <Switch
            checked={reducedMotion}
            onCheckedChange={(val) => updateSetting("reducedMotion", val)}
          />
        </div>

        {/* High Contrast */}
        <div className="flex items-center justify-between p-6 border-b border-border/50 gap-4 flex-wrap">
          <div className="flex flex-col gap-1 pr-4">
            <Label className="text-base font-extrabold text-foreground">High Contrast</Label>
            <p className="text-sm text-muted-foreground m-0">Increase contrast between text and backgrounds.</p>
          </div>
          <Switch
            checked={highContrast}
            onCheckedChange={(val) => updateSetting("highContrast", val)}
          />
        </div>

        {/* Large Text */}
        <div className="flex items-center justify-between p-6 gap-4 flex-wrap">
          <div className="flex flex-col gap-1 pr-4">
            <Label className="text-base font-extrabold text-foreground">Large Text</Label>
            <p className="text-sm text-muted-foreground m-0">Increase the base font size for reading materials.</p>
          </div>
          <Switch
            checked={largeText}
            onCheckedChange={(val) => updateSetting("largeText", val)}
          />
        </div>

      </div>
    </motion.div>
  );
}
