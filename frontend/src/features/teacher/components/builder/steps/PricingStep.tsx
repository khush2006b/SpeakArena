"use client";

import * as React from "react";
import { Tag, Globe, Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBuilderStore } from "@/stores/builder.store";
import type { AccessType } from "@/stores/builder.store";
import { cn } from "@/lib/utils";

export function PricingStep() {
  const {
    nextStep, prevStep,
    price, setPrice,
    discountedPrice, setDiscountedPrice,
    accessType, setAccessType,
    maxStudents, setMaxStudents,
  } = useBuilderStore();

  const handleContinue = () => {
    nextStep();
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Pricing &amp; Enrollment Capacity</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Set up pricing, student seat limits, and access rules for your course.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Price Input */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Base Price (INR)</label>
          <div className="flex h-11 w-full rounded-xl border border-input bg-background/80 overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
            <div className="flex items-center justify-center px-3.5 bg-muted/40 border-r border-border/50 text-emerald-400 font-extrabold text-sm shrink-0 select-none">
              ₹
            </div>
            <input
              type="number"
              min={0}
              step={1}
              value={price || ""}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              placeholder="199"
              className="w-full h-full bg-transparent px-3 text-sm font-semibold text-foreground focus:outline-none"
            />
          </div>
          <p className="text-xs text-muted-foreground">Set to 0 for free access.</p>
        </div>

        {/* Discount Input */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Discounted Price (Optional)</label>
          <div className="flex h-11 w-full rounded-xl border border-input bg-background/80 overflow-hidden focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500/50 transition-all">
            <div className="flex items-center justify-center px-3 bg-muted/40 border-r border-border/50 text-amber-400 shrink-0 select-none">
              <Tag className="h-4 w-4" />
            </div>
            <input
              type="number"
              min={0}
              step={1}
              value={discountedPrice ?? ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setDiscountedPrice(isNaN(v) ? null : v);
              }}
              placeholder="149"
              className="w-full h-full bg-transparent px-3 text-sm font-semibold text-foreground focus:outline-none"
            />
          </div>
          {discountedPrice !== null && price > 0 && discountedPrice >= price && (
            <p className="text-xs text-destructive">Discounted price must be less than base price.</p>
          )}
        </div>

        {/* Student Seat Limit Input */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center justify-between">
            <span>Student Seat Limit</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-mono font-bold border border-violet-500/25">
              {maxStudents || 50} seats
            </span>
          </label>
          <div className="flex h-11 w-full rounded-xl border border-input bg-background/80 overflow-hidden focus-within:ring-2 focus-within:ring-violet-500/30 focus-within:border-violet-500/50 transition-all">
            <div className="flex items-center justify-center px-3 bg-muted/40 border-r border-border/50 text-violet-400 shrink-0 select-none">
              <Users className="h-4 w-4" />
            </div>
            <input
              type="number"
              min={1}
              max={100000}
              value={maxStudents === 0 ? "" : maxStudents}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") {
                  setMaxStudents(0);
                } else {
                  const parsed = parseInt(val, 10);
                  setMaxStudents(isNaN(parsed) ? 0 : parsed);
                }
              }}
              placeholder="50"
              className="w-full h-full bg-transparent px-3 text-sm font-semibold text-foreground focus:outline-none"
            />
          </div>
          <p className="text-xs text-muted-foreground">Maximum students allowed to enroll (default: 50).</p>
        </div>
      </div>

      {/* Access Rules */}
      <div className="space-y-4 pt-6 border-t border-border">
        <h3 className="text-sm font-semibold text-foreground">Access Rules</h3>

        {(
          [
            {
              id: "public",
              icon: <Globe className="h-5 w-5 text-primary" />,
              label: "Public (Paid)",
              desc: "Anyone can purchase and access this course on the marketplace.",
            },
            {
              id: "private",
              icon: <Lock className="h-5 w-5 text-violet-400" />,
              label: "Private (Invite Only)",
              desc: "Only students with a direct link or cohort invite can access.",
            },
          ] as { id: AccessType; icon: React.ReactNode; label: string; desc: string }[]
        ).map(({ id, icon, label, desc }) => (
          <div
            key={id}
            onClick={() => setAccessType(id)}
            className={cn(
              "flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all",
              accessType === id
                ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20"
                : "border-border/50 bg-secondary/20 hover:bg-secondary/40"
            )}
          >
            <div className="mt-0.5 shrink-0">{icon}</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
            <div
              className={cn(
                "h-4 w-4 rounded-full border-2 mt-0.5 shrink-0 transition-all",
                accessType === id
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/40"
              )}
            />
          </div>
        ))}
      </div>

      <div className="pt-6 border-t border-border flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          ← Back to Live Classes
        </Button>
        <Button onClick={handleContinue} className="shadow-sm shadow-primary/20 px-8 press-scale">
          Continue to Preview →
        </Button>
      </div>
    </div>
  );
}
