"use client";

import * as React from "react";
import { 
  Upload, 
  Filter, 
  SortDesc,
  LayoutGrid,
  List,
  Layout
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMediaStore } from "@/stores/media.store";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

export function MediaHeader() {
  const { viewMode, setViewMode } = useMediaStore();
  const router = useRouter();

  const handleSimulateUpload = () => {
    toast.success('Redirecting to resource upload...');
    router.push('/teacher/resources');
  };

  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-end mb-8">
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-11 rounded-xl border-white/10 bg-white/[0.02] hover:bg-white/[0.05] shadow-sm text-muted-foreground hover:text-foreground font-semibold tracking-wide transition-all press-scale">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl">
            <DropdownMenuLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground">File Type</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuRadioGroup value="all">
              <DropdownMenuRadioItem value="all" className="font-medium cursor-pointer">All Types</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="video" className="font-medium cursor-pointer">Videos</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="pdf" className="font-medium cursor-pointer">PDFs</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="image" className="font-medium cursor-pointer">Images</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-11 rounded-xl border-white/10 bg-white/[0.02] hover:bg-white/[0.05] shadow-sm text-muted-foreground hover:text-foreground font-semibold tracking-wide transition-all press-scale">
              <SortDesc className="mr-2 h-4 w-4" />
              Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl">
            <DropdownMenuLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Sort By</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuRadioGroup value="newest">
              <DropdownMenuRadioItem value="newest" className="font-medium cursor-pointer">Newest First</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="oldest" className="font-medium cursor-pointer">Oldest First</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="name" className="font-medium cursor-pointer">Name (A-Z)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="size" className="font-medium cursor-pointer">Size (Largest)</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-8 w-px bg-white/10 hidden sm:block mx-1" />

        {/* View Toggles */}
        <div className="flex items-center rounded-xl border border-white/10 p-1 bg-white/[0.02] hidden sm:flex shadow-sm">
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "flex items-center justify-center rounded-lg px-2.5 py-2 transition-all duration-300",
              viewMode === "grid" ? "bg-white/10 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
            title="Grid View"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "flex items-center justify-center rounded-lg px-2.5 py-2 transition-all duration-300",
              viewMode === "list" ? "bg-white/10 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
            title="List View"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("gallery")}
            className={cn(
              "flex items-center justify-center rounded-lg px-2.5 py-2 transition-all duration-300",
              viewMode === "gallery" ? "bg-white/10 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
            title="Gallery View"
          >
            <Layout className="h-4 w-4" />
          </button>
        </div>

        <Button 
          className="h-11 rounded-xl shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary-rgb),0.5)] transition-all sm:ml-2 font-bold tracking-wide press-scale"
          onClick={handleSimulateUpload}
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload Files
        </Button>
      </div>
    </div>
  );
}
