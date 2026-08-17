"use client";

import * as React from "react";
import { useStudentSettingsStore } from "@/stores/student-settings.store";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";

export function VideoPreferences() {
  const { defaultPlaybackSpeed, autoplayNext, theaterMode, updateSetting } = useStudentSettingsStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="page-title">Video Playback</h2>
        <p className="page-subtitle">Customize your video player experience.</p>
      </div>

      <div className="card-glass overflow-hidden flex flex-col">

        {/* Default Playback Speed */}
        <div className="flex items-center justify-between p-6 border-b border-border/50 gap-4 flex-wrap">
          <div className="flex flex-col gap-1 pr-4">
            <Label className="text-base font-extrabold text-foreground">Default Playback Speed</Label>
            <p className="text-sm text-muted-foreground m-0">The initial speed for all video lessons.</p>
          </div>
          <Select
            value={defaultPlaybackSpeed}
            onValueChange={(val) => updateSetting("defaultPlaybackSpeed", val)}
          >
            <SelectTrigger className="w-28 bg-background border-border text-foreground rounded-xl">
              <SelectValue placeholder="Speed" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              <SelectItem value="1x">Normal</SelectItem>
              <SelectItem value="1.25x">1.25x</SelectItem>
              <SelectItem value="1.5x">1.5x</SelectItem>
              <SelectItem value="2x">2x</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Autoplay Next Lesson */}
        <div className="flex items-center justify-between p-6 border-b border-border/50 gap-4 flex-wrap">
          <div className="flex flex-col gap-1 pr-4">
            <Label className="text-base font-extrabold text-foreground">Autoplay Next Lesson</Label>
            <p className="text-sm text-muted-foreground m-0">Automatically start the next video when the current one ends.</p>
          </div>
          <Switch
            checked={autoplayNext}
            onCheckedChange={(val) => updateSetting("autoplayNext", val)}
          />
        </div>

        {/* Theater Mode */}
        <div className="flex items-center justify-between p-6 gap-4 flex-wrap">
          <div className="flex flex-col gap-1 pr-4">
            <Label className="text-base font-extrabold text-foreground">Default Theater Mode</Label>
            <p className="text-sm text-muted-foreground m-0">Always open the video player in wide theater mode.</p>
          </div>
          <Switch
            checked={theaterMode}
            onCheckedChange={(val) => updateSetting("theaterMode", val)}
          />
        </div>

      </div>
    </motion.div>
  );
}
