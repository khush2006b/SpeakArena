"use client";

import * as React from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurriculumStore, LessonFilter } from "@/stores/curriculum.store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CurriculumFilters() {
  const { activeFilter, setActiveFilter } = useCurriculumStore();

  const handleFilterChange = (val: string) => {
    setActiveFilter(val as LessonFilter);
  };

  return (
    <div className="p-3 border-b border-border/40 shrink-0 bg-background/95 backdrop-blur-xl z-10 flex flex-col gap-3">
      
      {/* Filter Dropdown */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Filter: {activeFilter}
        </span>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground px-2">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              Options
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-black/90 backdrop-blur-xl border-white/10 text-white rounded-xl shadow-2xl">
            <DropdownMenuRadioGroup value={activeFilter} onValueChange={handleFilterChange}>
              <DropdownMenuRadioItem value="all" className="focus:bg-white/10 text-xs">All Lessons</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="incomplete" className="focus:bg-white/10 text-xs">Incomplete</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="completed" className="focus:bg-white/10 text-xs">Completed</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="bookmarked" className="focus:bg-white/10 text-xs">Bookmarked</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="live" className="focus:bg-white/10 text-xs">Live Classes</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </div>
  );
}
