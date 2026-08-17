"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

interface StickySidebarLayoutProps {
  sidebar: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
  mobileSidebarTitle?: string;
}

export function StickySidebarLayout({ 
  sidebar, 
  header, 
  children,
  mobileSidebarTitle = "Navigation"
}: StickySidebarLayoutProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="mx-auto w-full max-w-[1600px] h-[calc(100vh-4rem)] flex overflow-hidden border-x border-border/50 bg-secondary/10">
      
      {/* Desktop Navigation */}
      <div className="w-[280px] hidden lg:flex shrink-0 flex-col bg-background/50 border-r border-border/50 h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar relative z-10">
        {sidebar}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background shadow-sm relative z-0 overflow-y-auto custom-scrollbar">
        
        {/* Header with Mobile Trigger */}
        <div className="sticky top-0 z-20 flex items-center bg-background/95 backdrop-blur border-b border-border/50">
          <div className="lg:hidden p-4 flex items-center border-r border-border/50">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] p-0 border-r border-border/50">
                <SheetTitle className="sr-only">{mobileSidebarTitle}</SheetTitle>
                <div className="h-full overflow-y-auto custom-scrollbar" onClick={() => setIsOpen(false)}>
                  {sidebar}
                </div>
              </SheetContent>
            </Sheet>
          </div>
          {header && <div className="flex-1 min-w-0">{header}</div>}
        </div>
        
        <div className="flex-1 p-4 sm:p-6 lg:p-10 max-w-5xl w-full mx-auto">
          {children}
        </div>
      </div>

    </div>
  );
}
