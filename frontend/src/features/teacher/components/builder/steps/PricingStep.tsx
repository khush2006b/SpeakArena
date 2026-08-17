"use client";

import * as React from "react";
import { DollarSign, Tag, Globe, Lock } from "lucide-react";
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
  } = useBuilderStore();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Pricing &amp; Monetization</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Set up pricing, discounts, and access rules for your students.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Price Input */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Base Price (USD)</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="number"
              min={0}
              step={0.01}
              value={price || ""}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              placeholder="199.00"
              className="w-full h-11 rounded-md border border-input bg-background pl-9 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-all font-medium"
            />
          </div>
          <p className="text-xs text-muted-foreground">Set to 0 to make the course free.</p>
        </div>

        {/* Discount Input */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Discounted Price (Optional)</label>
          <div className="relative">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="number"
              min={0}
              step={0.01}
              value={discountedPrice ?? ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setDiscountedPrice(isNaN(v) ? null : v);
              }}
              placeholder="149.00"
              className="w-full h-11 rounded-md border border-input bg-background pl-9 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-all"
            />
          </div>
          {discountedPrice !== null && price > 0 && discountedPrice >= price && (
            <p className="text-xs text-destructive">Discounted price must be less than base price.</p>
          )}
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
        <Button onClick={nextStep} className="shadow-sm shadow-primary/20 px-8 press-scale">
          Continue to Preview →
        </Button>
      </div>
    </div>
  );
}
