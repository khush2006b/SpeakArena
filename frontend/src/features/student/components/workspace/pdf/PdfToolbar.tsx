"use client";

import * as React from "react";
import { 
  ZoomIn, ZoomOut, Maximize2, Columns, 
  Search, Download, Bookmark, BookmarkCheck,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePdfStore } from "@/stores/pdf.store";

export function PdfToolbar() {
  const { 
    zoomLevel, setZoomLevel, 
    fitMode, setFitMode,
    isLeftPanelOpen, toggleLeftPanel,
    isRightPanelOpen, toggleRightPanel,
    currentPage, toggleBookmark, bookmarks,
    searchQuery, setSearchQuery
  } = usePdfStore();

  const isBookmarked = bookmarks.some(b => b.pageNumber === currentPage);

  return (
    <div className="h-14 flex items-center justify-between px-4 border-b border-border/40 bg-background/95 backdrop-blur-xl shrink-0 z-20">
      
      {/* Left side: Panel Toggle & Document Info */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleLeftPanel} className="text-muted-foreground hover:text-foreground">
          {isLeftPanelOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
        </Button>
        <div className="h-6 w-[1px] bg-border/50 mx-2 hidden md:block" />
        <div className="flex flex-col hidden md:flex">
          <span className="text-sm font-semibold leading-tight line-clamp-1">Frontend Architecture.pdf</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Resource</span>
        </div>
      </div>

      {/* Center: Controls (Zoom, Fit, Search) */}
      <div className="flex items-center gap-2 md:gap-4">
        
        {/* Zoom Controls */}
        <div className="flex items-center bg-secondary/50 rounded-lg p-1 border border-border/30">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded" onClick={() => setZoomLevel(zoomLevel - 25)}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs font-mono w-12 text-center select-none">{zoomLevel}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded" onClick={() => setZoomLevel(zoomLevel + 25)}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        {/* Fit Toggles */}
        <div className="flex items-center bg-secondary/50 rounded-lg p-1 border border-border/30 hidden sm:flex">
          <Button 
            variant="ghost" 
            size="icon" 
            className={`h-7 w-7 rounded ${fitMode === 'width' ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}
            onClick={() => setFitMode("width")}
            title="Fit Width"
          >
            <Columns className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className={`h-7 w-7 rounded ${fitMode === 'page' ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}
            onClick={() => setFitMode("page")}
            title="Fit Page"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative hidden lg:flex items-center w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input 
            placeholder="Search PDF..." 
            className="h-8 pl-8 text-xs bg-secondary/50 border-border/30 focus-visible:ring-primary/30"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

      </div>

      {/* Right side: Actions & Right Panel Toggle */}
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="icon" 
          className={isBookmarked ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-foreground"}
          onClick={() => toggleBookmark(currentPage)}
        >
          {isBookmarked ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
        </Button>
        
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hidden sm:flex">
          <Download className="h-5 w-5" />
        </Button>

        <div className="h-6 w-[1px] bg-border/50 mx-1" />

        <Button variant="ghost" size="icon" onClick={toggleRightPanel} className="text-muted-foreground hover:text-foreground">
          {isRightPanelOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
        </Button>
      </div>

    </div>
  );
}
