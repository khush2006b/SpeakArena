"use client";

import * as React from "react";
import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  const { searchQuery, setSearchQuery, activeFilter, setActiveFilter } = useCurriculumStore();

  const handleFilterChange = (val: string) => {
    setActiveFilter(val as LessonFilter);
  };

  return (
    <div className="p-3 border-b border-border/40 shrink-0 bg-background/95 backdrop-blur-xl z-10 flex flex-col gap-3">
      
      {/* Search Bar */}
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search lessons..." 
          className="pl-8 pr-12 bg-secondary/50 border-border/50 h-9 text-sm focus-visible:ring-primary/20 w-full"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {/* Keyboard shortcut hint */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-1">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border/50 bg-secondary/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>

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
