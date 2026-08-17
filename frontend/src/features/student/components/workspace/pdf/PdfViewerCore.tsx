"use client";

import * as React from "react";
import { usePdfStore } from "@/stores/pdf.store";
import { Loader2 } from "lucide-react";

export function PdfViewerCore() {
  const { currentPage, totalPages, setCurrentPage, zoomLevel, fitMode } = usePdfStore();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Simulate PDF loading time
  React.useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // Sync scroll position when currentPage changes
  React.useEffect(() => {
    if (!isLoading && containerRef.current) {
      const pageEl = document.getElementById(`pdf-page-${currentPage}`);
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [currentPage, isLoading]);

  // Observer to update currentPage based on scroll position
  React.useEffect(() => {
    if (isLoading || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageId = entry.target.id.split('-')[2];
            setCurrentPage(parseInt(pageId));
          }
        });
      },
      { root: containerRef.current, threshold: 0.5 }
    );

    const pages = containerRef.current.querySelectorAll('.pdf-page');
    pages.forEach((page) => observer.observe(page));

    return () => {
      pages.forEach((page) => observer.unobserve(page));
    };
  }, [isLoading, setCurrentPage]);

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          if (currentPage < totalPages) setCurrentPage(currentPage + 1);
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          if (currentPage > 1) setCurrentPage(currentPage - 1);
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, setCurrentPage]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-secondary/5 h-full">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading Document...</p>
      </div>
    );
  }

  // Calculate width based on fit mode and zoom
  const pageContainerStyle = fitMode === "width" 
    ? { width: '100%', maxWidth: '1000px', transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }
    : { height: '100%', transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' };

  return (
    <div 
      ref={containerRef}
      className="flex-1 bg-secondary/20 overflow-y-auto custom-scrollbar flex flex-col items-center relative"
    >
      <div className="w-full flex flex-col items-center py-8 gap-8" style={{ transition: 'transform 0.2s ease-out' }}>
        
        {Array.from({ length: totalPages }).map((_, i) => {
          const pageNum = i + 1;
          
          return (
            <div 
              key={pageNum}
              id={`pdf-page-${pageNum}`}
              className="pdf-page bg-white shadow-2xl relative"
              style={{
                ...pageContainerStyle,
                aspectRatio: '1 / 1.414', // Standard A4 ratio
              }}
            >
              {/* High-Fidelity Mock PDF Content */}
              <div className="absolute inset-0 p-12 md:p-20 flex flex-col pointer-events-none select-none">
                
                {/* Header */}
                <div className="flex justify-between border-b border-black/10 pb-4 mb-8">
                  <span className="text-black/40 font-mono text-xs">SpeakArena Enterprise</span>
                  <span className="text-black/40 font-mono text-xs">Page {pageNum}</span>
                </div>
                
                {/* Body Content */}
                <h1 className="text-3xl md:text-5xl font-serif text-black/90 font-bold mb-6">
                  {pageNum === 1 ? "Frontend Architecture" : `Section ${pageNum}: Deep Dive`}
                </h1>
                
                <p className="text-black/80 font-serif leading-relaxed text-lg md:text-xl text-justify mb-6">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                </p>

                {pageNum % 2 === 0 && (
                  <div className="w-full aspect-video bg-black/5 rounded-lg border border-black/10 my-8 flex items-center justify-center">
                    <span className="text-black/30 font-mono text-sm">[ Diagram Placeholder ]</span>
                  </div>
                )}
                
                <p className="text-black/80 font-serif leading-relaxed text-lg md:text-xl text-justify">
                  Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.
                </p>
                
                {/* Text selection layer simulation (invisible but selectable) */}
                <div className="absolute inset-0 pointer-events-auto opacity-0 selection:bg-yellow-300/40">
                  {"Mock selectable text layer mapping over the visual text to allow user highlighting in future."}
                </div>

              </div>
            </div>
          );
        })}
        
      </div>
    </div>
  );
}
