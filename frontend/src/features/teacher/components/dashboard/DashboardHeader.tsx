"use client";

import * as React from "react";
import { format } from "date-fns";
import { apiClient } from "@/services/api/client";

export function DashboardHeader() {
  const today = new Date();
  const [name, setName] = React.useState("Teacher");

  React.useEffect(() => {
    apiClient.get("/api/v1/teacher/profile").then(({ data }) => {
      setName(data?.data?.full_name || data?.data?.first_name || data?.full_name || data?.first_name || "Teacher");
    }).catch(() => {});
  }, []);
  
  return (
    <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-6 sm:p-8 mb-8 hover-lift card-glass">
      <div className="grid-bg absolute inset-0 opacity-40 pointer-events-none" />
      <div 
        className="glow-purple absolute pointer-events-none" 
        style={{ width: 400, height: 400, top: -100, left: "50%", transform: "translateX(-50%)", background: "radial-gradient(circle, hsl(270 80% 60% / 0.15) 0%, transparent 70%)" }} 
      />
      
      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-responsive-xl font-extrabold tracking-tight text-foreground mb-1">
            Welcome back, {name}!
          </h1>
          <p className="text-muted-foreground text-responsive-lg">
            Here's what's happening with your courses today.
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-background border border-border rounded-full px-4 py-2 hover-lift">
          <div className="w-2 h-2 rounded-full" style={{ background: "hsl(270 80% 60%)" }} />
          <span className="text-sm font-semibold text-foreground">
            {format(today, "EEEE, MMMM do, yyyy")}
          </span>
        </div>
      </div>
    </div>
  );
}
