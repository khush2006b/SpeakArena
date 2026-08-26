"use client";

import * as React from "react";
import { format } from "date-fns";
import { 
  ChevronLeft, 
  ChevronRight, 
  Filter,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMeetingStore } from "@/stores/meeting.store";

export function MeetingHeader() {
  const { calendarView, currentDate, setCurrentDate, setCreateModalOpen } = useMeetingStore();

  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    if (calendarView === "month") newDate.setMonth(newDate.getMonth() - 1);
    else if (calendarView === "week") newDate.setDate(newDate.getDate() - 7);
    else newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (calendarView === "month") newDate.setMonth(newDate.getMonth() + 1);
    else if (calendarView === "week") newDate.setDate(newDate.getDate() + 7);
    else newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="relative overflow-hidden animate-fade-up">
      {/* Ambient glow */}
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Date Navigation */}
        <div className="flex items-center gap-4">
          <h1 className="text-responsive-xl font-extrabold tracking-tighter drop-shadow-sm w-48 shrink-0">
            {format(currentDate, "MMMM yyyy")}
          </h1>
          <div className="flex items-center gap-1 bg-card/80 backdrop-blur-sm rounded-xl p-1 border border-border/60">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors press-scale"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={handleToday}
              className="h-9 px-4 text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground hover:bg-accent transition-colors press-scale"
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors press-scale"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Right: Actions & Views */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 bg-card/80 border-border/60 hover:bg-accent text-muted-foreground press-scale transition-all"
          >
            <Filter className="h-4 w-4" />
          </Button>

          <div className="h-6 w-px bg-border/60 hidden sm:block mx-1" />

          <button
            className="btn-primary press-scale sm:ml-2"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Schedule Live Class
          </button>
        </div>
      </div>
    </div>
  );
}
