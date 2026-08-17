"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";

export function SecuritySettings() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="page-title">Password &amp; Security</h2>
        <p className="page-subtitle">Manage your password and secure your account.</p>
      </div>

      <div className="card-glass p-6 flex flex-col gap-6">

        {/* Password Change Form */}
        <div className="flex flex-col gap-4 max-w-sm">
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Current Password</Label>
            <Input type="password" placeholder="Enter current password" className="input-glass" />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">New Password</Label>
            <Input type="password" placeholder="Create new password" className="input-glass" />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Confirm New Password</Label>
            <Input type="password" placeholder="Confirm new password" className="input-glass" />
          </div>
          <button className="btn-primary w-full press-scale">Update Password</button>
        </div>

        {/* 2FA Section */}
        <div className="pt-6 border-t border-border/50">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <Label className="text-base font-extrabold text-foreground">Two-Factor Authentication (2FA)</Label>
              <p className="text-sm text-muted-foreground m-0">Add an extra layer of security to your account.</p>
            </div>
            <button className="btn-ghost press-scale">Enable 2FA</button>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
