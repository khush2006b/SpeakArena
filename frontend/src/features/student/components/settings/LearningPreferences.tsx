"use client";

import * as React from "react";
import { useStudentSettingsStore } from "@/stores/student-settings.store";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";

export function LearningPreferences() {
  const { dailyGoal, autoResumeLearning, updateSetting } = useStudentSettingsStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="page-title">Learning Preferences</h2>
        <p className="page-subtitle">Configure your daily study targets and learning flow.</p>
      </div>

      <div className="card-glass overflow-hidden flex flex-col">

        {/* Daily Study Goal */}
        <div className="flex items-center justify-between p-6 border-b border-border/50 gap-4 flex-wrap">
          <div className="flex flex-col gap-1 pr-4">
            <Label className="text-base font-extrabold text-foreground">Daily Study Goal</Label>
            <p className="text-sm text-muted-foreground m-0">Target minutes to study each day.</p>
          </div>
          <Select
            value={dailyGoal.toString()}
            onValueChange={(val) => updateSetting("dailyGoal", parseInt(val))}
          >
            <SelectTrigger className="w-32 bg-background border-border text-foreground rounded-xl">
              <SelectValue placeholder="Select goal" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              <SelectItem value="15">15 mins</SelectItem>
              <SelectItem value="30">30 mins</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
              <SelectItem value="120">2 hours</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Auto-Resume Learning */}
        <div className="flex items-center justify-between p-6 gap-4 flex-wrap">
          <div className="flex flex-col gap-1 pr-4">
            <Label className="text-base font-extrabold text-foreground">Auto-Resume Learning</Label>
            <p className="text-sm text-muted-foreground m-0">Automatically pick up exactly where you left off when entering a course.</p>
          </div>
          <Switch
            checked={autoResumeLearning}
            onCheckedChange={(val) => updateSetting("autoResumeLearning", val)}
          />
        </div>

      </div>
    </motion.div>
  );
}
