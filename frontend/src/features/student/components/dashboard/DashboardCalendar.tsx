"use client";

import * as React from "react";
import { Calendar as CalendarIcon, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function DashboardCalendar() {
  return (
    <Card className="h-full flex flex-col card-glass hover-lift" style={{ borderRadius: 16 }}>
      <CardHeader className="p-4 sm:p-6 pb-0 flex flex-row items-center justify-between">
        <CardTitle className="text-responsive-lg flex items-center gap-2 text-foreground font-extrabold">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          Study Calendar
        </CardTitle>
        <Button variant="ghost" size="sm" className="text-xs hover:text-primary/80 -mr-2 text-primary btn-ghost press-scale">
          View All <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-4 flex-1 flex flex-col gap-4">
        
        {/* Mock Calendar Events */}
        <div className="flex gap-4 group cursor-pointer p-2 rounded-xl transition-colors hover:bg-accent/50" style={{ borderRadius: 10 }}>
          <div className="flex flex-col items-center justify-center w-12 shrink-0 rounded-lg p-1.5 transition-colors bg-primary/10 border border-primary/30">
            <span className="text-xs font-bold text-primary">OCT</span>
            <span className="text-lg font-black text-foreground">24</span>
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-xs font-semibold mb-0.5 text-primary">09:00 AM</span>
            <span className="text-sm font-semibold line-clamp-1 text-foreground">Data Structures Q&A</span>
            <span className="text-xs line-clamp-1 text-muted-foreground">Live Meeting</span>
          </div>
        </div>

        <div className="flex gap-4 group cursor-pointer p-2 rounded-xl transition-colors hover:bg-accent/50" style={{ borderRadius: 10 }}>
          <div className="flex flex-col items-center justify-center w-12 shrink-0 rounded-lg p-1.5 transition-colors bg-card border border-border">
            <span className="text-xs font-bold text-muted-foreground">OCT</span>
            <span className="text-lg font-black text-foreground">26</span>
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-xs font-semibold mb-0.5 text-destructive">Due Date</span>
            <span className="text-sm font-semibold line-clamp-1 text-foreground">Module 3 Assignment</span>
            <span className="text-xs line-clamp-1 text-muted-foreground">Advanced Frontend</span>
          </div>
        </div>
        
        {/* Empty state padding to push content up if needed */}
        <div className="mt-auto" />
      </CardContent>
    </Card>
  );
}
