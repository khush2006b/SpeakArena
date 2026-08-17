"use client";

import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function NotificationSettings() {
  return (
    <div className="flex-1 flex flex-col h-full bg-background border-l border-border/50 animate-fade-up">
      <div className="shrink-0 p-6 border-b border-border/50 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-foreground">
            Notification Preferences
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage how you receive alerts and emails.
          </p>
        </div>
        <Button className="btn-primary press-scale font-bold">
          Save Changes
        </Button>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-8 pb-12">

          <section>
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Email Notifications
            </h3>
            <div className="card-glass overflow-hidden flex flex-col">
              <SettingRow
                title="Weekly Digest"
                description="Receive a weekly summary of your learning progress."
                defaultChecked
                border
              />
              <SettingRow
                title="Live Class Reminders"
                description="Get an email 15 minutes before a class starts."
                defaultChecked
                border
              />
              <SettingRow
                title="Marketing & Offers"
                description="Receive promotional offers and new course launches."
              />
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              In-App Alerts
            </h3>
            <div className="card-glass overflow-hidden flex flex-col">
              <SettingRow
                title="Course Updates"
                description="Notifications when new modules or PDFs are added."
                defaultChecked
                border
              />
              <SettingRow
                title="Achievement Unlocked"
                description="Celebrate your milestones instantly."
                defaultChecked
              />
            </div>
          </section>

        </div>
      </ScrollArea>
    </div>
  );
}

function SettingRow({
  title,
  description,
  defaultChecked,
  border,
}: {
  title: string;
  description: string;
  defaultChecked?: boolean;
  border?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between p-4 ${
        border ? "border-b border-border/40" : ""
      }`}
    >
      <div className="flex flex-col gap-1 pr-4">
        <Label className="text-base font-bold text-foreground cursor-pointer">
          {title}
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked ?? false} />
    </div>
  );
}
