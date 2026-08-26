"use client";

import * as React from "react";
import { LayoutGrid, List, SlidersHorizontal, ArrowDownAZ } from "lucide-react";
import { useCoursesStore } from "@/stores/courses.store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CoursesHeader() {
  const { viewMode, setViewMode } = useCoursesStore();

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 sticky top-16 z-30 backdrop-blur-xl -mx-4 px-4 sm:mx-0 sm:px-0"
         style={{ background: "hsla(var(--background), 0.8)", borderBottom: "1px solid hsl(var(--border))" }}>
      
      {/* Title */}
      <div className="flex items-center gap-6 flex-1 w-full sm:w-auto">
        <h1 className="tracking-tight text-foreground font-extrabold text-responsive-xl" style={{ letterSpacing: "-0.03em" }}>My Courses</h1>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 custom-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
        
        {/* Filters */}
        <Button variant="outline" className="h-10 shrink-0 bg-card border-border text-muted-foreground rounded-lg btn-outline press-scale">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Filters
        </Button>

        {/* Sort */}
        <div className="shrink-0 w-[160px]">
          <Select defaultValue="recent">
            <SelectTrigger className="h-10 bg-card border-border text-muted-foreground rounded-lg">
              <div className="flex items-center gap-2">
                <ArrowDownAZ className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Sort by" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              <SelectItem value="recent" className="focus:bg-accent">Recently Accessed</SelectItem>
              <SelectItem value="progress" className="focus:bg-accent">Highest Progress</SelectItem>
              <SelectItem value="newest" className="focus:bg-accent">Newest Enrolled</SelectItem>
              <SelectItem value="alpha" className="focus:bg-accent">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-px h-6 mx-1 shrink-0 hidden sm:block bg-border" />

        {/* View Toggle */}
        <div className="flex items-center rounded-lg p-1 shrink-0 bg-card border border-border">
          <Button 
            variant={viewMode === "grid" ? "default" : "ghost"} 
            size="icon" 
            className={`h-8 w-8 rounded-md transition-colors press-scale ${viewMode === "grid" ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button 
            variant={viewMode === "list" ? "default" : "ghost"} 
            size="icon" 
            className={`h-8 w-8 rounded-md transition-colors press-scale ${viewMode === "list" ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

      </div>
    </div>
  );
}
