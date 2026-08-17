"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { LayoutGrid, List, Bookmark } from "lucide-react";
import { usePdfStore } from "@/stores/pdf.store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

export function PdfLeftPanel() {
  const { 
    isLeftPanelOpen, activeLeftTab, setActiveLeftTab, 
    currentPage, totalPages, setCurrentPage,
    bookmarks 
  } = usePdfStore();

  if (!isLeftPanelOpen) return null;

  // Mock Outline Data
  const outline = [
    { id: 1, title: "1. Introduction to Architecture", page: 1 },
    { id: 2, title: "2. The Request / Response Lifecycle", page: 3 },
    { id: 3, title: "3. React Server Components", page: 5 },
    { id: 4, title: "3.1 Server vs Client Boundaries", page: 6 },
    { id: 5, title: "3.2 Serializing Data", page: 8 },
    { id: 6, title: "4. Streaming & Suspense", page: 10 },
  ];

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 280, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="h-full shrink-0 border-r border-border/40 bg-background/80 backdrop-blur-xl flex flex-col relative overflow-hidden z-10"
    >
      
      {/* Tabs */}
      <div className="flex items-center gap-1 p-2 border-b border-border/40 shrink-0">
        <Button 
          variant={activeLeftTab === "thumbnails" ? "secondary" : "ghost"} 
          size="sm" 
          className="flex-1 h-8 text-xs font-medium"
          onClick={() => setActiveLeftTab("thumbnails")}
        >
          <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Thumbnails
        </Button>
        <Button 
          variant={activeLeftTab === "outline" ? "secondary" : "ghost"} 
          size="sm" 
          className="flex-1 h-8 text-xs font-medium"
          onClick={() => setActiveLeftTab("outline")}
        >
          <List className="h-3.5 w-3.5 mr-1.5" /> Outline
        </Button>
      </div>

      {/* Tab Content */}
      <ScrollArea className="flex-1 custom-scrollbar">
        <div className="p-3">
          
          {activeLeftTab === "thumbnails" && (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                const isCurrent = pageNum === currentPage;
                const hasBookmark = bookmarks.some(b => b.pageNumber === pageNum);

                return (
                  <div key={pageNum} className="flex flex-col items-center gap-1">
                    <button 
                      onClick={() => setCurrentPage(pageNum)}
                      className={`relative w-full aspect-[1/1.4] bg-white rounded-md shadow-sm overflow-hidden transition-all border-2 ${
                        isCurrent ? "border-primary ring-2 ring-primary/20 scale-[1.02]" : "border-border/10 hover:border-border/50"
                      }`}
                    >
                      {/* Fake PDF Content lines for aesthetic */}
                      <div className="absolute inset-2 flex flex-col gap-1 opacity-20">
                        <div className="h-2 w-3/4 bg-black rounded" />
                        <div className="h-1 w-full bg-black rounded" />
                        <div className="h-1 w-full bg-black rounded" />
                        <div className="h-1 w-5/6 bg-black rounded" />
                        <div className="h-8 w-full bg-black rounded mt-1" />
                        <div className="h-1 w-full bg-black rounded" />
                      </div>
                      
                      {hasBookmark && (
                        <div className="absolute top-0 right-1 text-primary">
                          <Bookmark className="h-4 w-4 fill-current" />
                        </div>
                      )}
                    </button>
                    <span className={`text-[10px] font-mono ${isCurrent ? "text-primary font-bold" : "text-muted-foreground"}`}>
                      {pageNum}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {activeLeftTab === "outline" && (
            <div className="flex flex-col gap-1 pb-10">
              
              {/* Bookmarks Section */}
              {bookmarks.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 mb-2">
                    Bookmarks
                  </div>
                  {bookmarks.map(b => (
                    <button 
                      key={`bm-${b.pageNumber}`}
                      onClick={() => setCurrentPage(b.pageNumber)}
                      className="w-full flex items-center justify-between p-2 rounded-md hover:bg-secondary/50 text-left group"
                    >
                      <span className="text-sm font-medium text-foreground line-clamp-1">{b.title}</span>
                      <span className="text-[10px] text-muted-foreground font-mono bg-background px-1.5 py-0.5 rounded border border-border/50">
                        Pg {b.pageNumber}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 mb-2">
                Table of Contents
              </div>
              {outline.map((item) => (
                <button 
                  key={item.id}
                  onClick={() => setCurrentPage(item.page)}
                  className={`w-full flex items-center justify-between p-2 rounded-md hover:bg-secondary/50 text-left group transition-colors ${
                    currentPage >= item.page && (item.id === outline.length || currentPage < outline[item.id]?.page) 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-foreground/80"
                  }`}
                >
                  <span className={`text-sm line-clamp-2 ${item.title.startsWith("3.") ? "ml-3" : ""}`}>
                    {item.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono opacity-50 group-hover:opacity-100">
                    {item.page}
                  </span>
                </button>
              ))}
            </div>
          )}

        </div>
      </ScrollArea>
    </motion.aside>
  );
}
