"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

export function DangerZone() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="text-xl font-extrabold text-destructive flex items-center gap-2 m-0">
          <AlertTriangle size={20} /> Danger Zone
        </h2>
        <p className="page-subtitle">Irreversible and destructive actions.</p>
      </div>

      {/* Red-tinted danger card */}
      <div className="bg-destructive/10 border border-destructive/30 rounded-2xl overflow-hidden flex flex-col">

        {/* Clear Offline Downloads */}
        <div className="flex flex-row items-center justify-between p-6 flex-wrap gap-4 border-b border-border/50">
          <div className="flex flex-col gap-1 pr-4">
            <h4 className="text-base font-extrabold text-foreground m-0">Clear Offline Downloads</h4>
            <p className="text-sm text-muted-foreground m-0">Remove all downloaded videos and PDFs from this device to free up space.</p>
          </div>
          <button className="btn-ghost shrink-0 press-scale">Clear Downloads</button>
        </div>

        {/* Reset Preferences */}
        <div className="flex flex-row items-center justify-between p-6 flex-wrap gap-4 border-b border-border/50">
          <div className="flex flex-col gap-1 pr-4">
            <h4 className="text-base font-extrabold text-foreground m-0">Reset Preferences</h4>
            <p className="text-sm text-muted-foreground m-0">Revert all local settings back to their default state.</p>
          </div>
          <button className="btn-ghost shrink-0 press-scale">Reset to Defaults</button>
        </div>

        {/* Deactivate Account */}
        <div className="flex flex-row items-center justify-between p-6 flex-wrap gap-4">
          <div className="flex flex-col gap-1 pr-4">
            <h4 className="text-base font-extrabold text-destructive m-0">Deactivate Account</h4>
            <p className="text-sm text-muted-foreground m-0">Temporarily hide your profile. You will not lose access to purchased courses.</p>
          </div>
          <button className="btn-danger shrink-0 press-scale">
            Deactivate
          </button>
        </div>

      </div>
    </motion.div>
  );
}
