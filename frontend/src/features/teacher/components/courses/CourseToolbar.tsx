"use client";

import * as React from "react";
import { 
  Search, 
  LayoutGrid, 
  List, 
  Filter, 
  SlidersHorizontal,
  ArrowUpDown
} from "lucide-react";
import { useUIStore } from "@/stores/ui.store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CourseToolbar() {
  const viewType = useUIStore((state) => state.courseViewType);
  const setViewType = useUIStore((state) => state.setCourseViewType);
  const search = useUIStore((state) => state.courseSearch);
  const setSearch = useUIStore((state) => state.setCourseSearch);
  const statusFilter = useUIStore((state) => state.courseStatusFilter);
  const setStatusFilter = useUIStore((state) => state.setCourseStatusFilter);

  const [sortStatus, setSortStatus] = React.useState("newest");

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 mb-4">
      {/* Search Bar */}
      <div className="relative w-full sm:max-w-md group">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <input
          type="text"
          placeholder="Search courses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg bg-background border border-border pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all shadow-sm"
        />
      </div>

      {/* Actions */}
      <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-3">
        <div className="flex items-center gap-2">
          {/* Filters Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 bg-card border-border hover:bg-muted shadow-none font-semibold tracking-tight transition-all btn-ghost press-scale">
                <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-card border-border shadow-2xl">
              <DropdownMenuLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Filter by Status</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                <DropdownMenuRadioItem value="all" className="font-medium text-foreground">All Courses</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="published" className="font-medium text-foreground">Published</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="draft" className="font-medium text-foreground">Draft</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="archived" className="font-medium text-foreground">Archived</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 bg-card border-border hover:bg-muted shadow-none font-semibold tracking-tight transition-all btn-ghost press-scale">
                <ArrowUpDown className="mr-2 h-4 w-4 text-muted-foreground" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-card border-border shadow-2xl">
              <DropdownMenuLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Sort Options</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuRadioGroup value={sortStatus} onValueChange={setSortStatus}>
                <DropdownMenuRadioItem value="newest" className="font-medium text-foreground">Newest First</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="oldest" className="font-medium text-foreground">Oldest First</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="revenue" className="font-medium text-foreground">Highest Revenue</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="students" className="font-medium text-foreground">Most Students</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="icon" className="h-10 w-10 bg-card border-border hover:bg-muted shadow-none transition-all btn-ghost press-scale" title="Advanced Filters">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>

        <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

        {/* View Toggle */}
        <div className="flex items-center rounded-lg border border-border p-1 bg-card">
          <button
            onClick={() => setViewType("grid")}
            className={cn(
              "flex items-center justify-center rounded-md px-2.5 py-1.5 transition-all press-scale",
              viewType === "grid" 
                ? "bg-muted shadow-sm text-foreground" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            title="Grid View"
          >
            <LayoutGrid className="h-[18px] w-[18px]" />
          </button>
          <button
            onClick={() => setViewType("list")}
            className={cn(
              "flex items-center justify-center rounded-md px-2.5 py-1.5 transition-all press-scale",
              viewType === "list" 
                ? "bg-muted shadow-sm text-foreground" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            title="List View"
          >
            <List className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
