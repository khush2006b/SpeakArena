"use client";

import * as React from "react";
import { Smartphone, Monitor, Globe } from "lucide-react";
import { motion } from "framer-motion";

export function ConnectedDevices() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="page-title">Connected Devices</h2>
        <p className="page-subtitle">Manage devices where you are currently logged in.</p>
      </div>

      <div className="card-glass overflow-hidden flex flex-col">

        {/* Current Device — MacBook */}
        <div className="flex items-center justify-between p-6 border-b border-border/50 gap-4">
          <div className="flex gap-4">
            <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Monitor size={20} />
            </div>
            <div>
              <p className="text-sm font-extrabold text-foreground flex items-center gap-2 m-0">
                MacBook Pro{" "}
                <span className="text-[10px] uppercase tracking-widest font-extrabold bg-emerald-500 text-white px-1.5 py-0.5 rounded">
                  This Device
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1 m-0">Chrome on macOS 14.5</p>
              <p className="text-xs text-muted-foreground/70 flex items-center gap-1 mt-1 m-0">
                <Globe size={12} /> San Francisco, CA &bull; Active Now
              </p>
            </div>
          </div>
        </div>

        {/* Secondary Device — iPhone */}
        <div className="flex items-center justify-between p-6 gap-4">
          <div className="flex gap-4">
            <div className="h-10 w-10 shrink-0 rounded-full bg-white/5 text-muted-foreground flex items-center justify-center">
              <Smartphone size={20} />
            </div>
            <div>
              <p className="text-sm font-extrabold text-foreground m-0">iPhone 14 Pro</p>
              <p className="text-xs text-muted-foreground mt-1 m-0">Safari on iOS 17.2</p>
              <p className="text-xs text-muted-foreground/70 flex items-center gap-1 mt-1 m-0">
                <Globe size={12} /> San Francisco, CA &bull; Last active 2 hours ago
              </p>
            </div>
          </div>
          <button className="btn-danger shrink-0 press-scale text-sm px-3 py-2">
            Log out
          </button>
        </div>

      </div>
    </motion.div>
  );
}
