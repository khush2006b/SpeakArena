"use client";

import * as React from "react";
import { MapPin } from "lucide-react";

export default function GeographicalMap() {
  return (
    <div className="card-glass hover-lift animate-fade-up w-full h-[400px] flex flex-col overflow-hidden">
      <div className="px-6 py-5 border-b border-border/50">
        <h3 className="text-foreground font-extrabold text-base flex items-center gap-2">
          <MapPin className="h-4 w-4 text-violet-400" />
          Geographical Distribution
        </h3>
        <p className="text-muted-foreground text-sm mt-1">Revenue density across global regions</p>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {/* Dot grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Glowing map nodes */}
        <div className="absolute top-[30%] left-[20%] h-4 w-4 rounded-full bg-violet-500/20 flex items-center justify-center">
          <div className="h-1.5 w-1.5 bg-violet-500 rounded-full" />
        </div>
        <div className="absolute top-[35%] left-[22%] h-8 w-8 rounded-full bg-violet-500/20 flex items-center justify-center">
          <div className="h-2 w-2 bg-violet-500 rounded-full shadow-[0_0_10px_hsl(var(--primary))]" />
        </div>

        <div className="absolute top-[25%] left-[45%] h-12 w-12 rounded-full bg-violet-500/20 flex items-center justify-center">
          <div className="h-3 w-3 bg-violet-500 rounded-full shadow-[0_0_15px_hsl(var(--primary))]" />
          <div className="absolute bg-card/90 backdrop-blur-sm border border-border/60 rounded-lg px-2 py-1.5 -top-10 whitespace-nowrap z-10 text-xs text-foreground">
            <span className="font-bold">Europe</span>
            <span className="text-muted-foreground ml-1">42% Revenue</span>
          </div>
        </div>

        <div className="absolute top-[45%] left-[75%] h-6 w-6 rounded-full bg-violet-500/20 flex items-center justify-center">
          <div className="h-2 w-2 bg-violet-500 rounded-full shadow-[0_0_10px_hsl(var(--primary))]" />
        </div>

        <div className="absolute top-[60%] left-[30%] h-4 w-4 rounded-full bg-violet-500/20 flex items-center justify-center">
          <div className="h-1.5 w-1.5 bg-violet-500 rounded-full" />
        </div>

        {/* Edge fade gradients using bg-background */}
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-card to-transparent" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-card to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-card to-transparent" />

        {/* Stats overlay */}
        <div className="absolute bottom-4 left-4 flex gap-3">
          <div className="bg-card/90 backdrop-blur-sm border border-border/60 rounded-lg px-3 py-2 text-xs">
            <span className="block text-muted-foreground mb-0.5">Top Region</span>
            <span className="font-bold text-foreground text-sm">North America</span>
          </div>
          <div className="bg-card/90 backdrop-blur-sm border border-border/60 rounded-lg px-3 py-2 text-xs">
            <span className="block text-muted-foreground mb-0.5">Emerging</span>
            <span className="font-bold text-foreground text-sm">South Asia</span>
          </div>
        </div>
      </div>
    </div>
  );
}
