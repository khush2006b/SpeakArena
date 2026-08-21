"use client";

import * as React from "react";
import { MapPin } from "lucide-react";

export default function GeographicalMap() {
  return (
    <div className="card-glass hover-lift animate-fade-up w-full h-[400px] flex flex-col overflow-hidden items-center justify-center text-center p-6">
      <MapPin className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <h3 className="text-foreground font-extrabold text-lg">Geographic analytics coming soon</h3>
      <p className="text-muted-foreground text-sm mt-2">Detailed revenue distribution maps are on the roadmap.</p>
    </div>
  );
}
