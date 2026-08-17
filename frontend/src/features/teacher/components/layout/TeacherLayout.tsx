"use client";

import * as React from "react";
import { TeacherSidebar } from "./TeacherSidebar";
import { TeacherHeader } from "./TeacherHeader";
import { GlobalSearchPalette } from "./GlobalSearchPalette";
import { NotificationDrawer } from "./NotificationDrawer";

export function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground transition-colors duration-200">
      <TeacherSidebar />
      
      <div className="flex flex-1 flex-col overflow-hidden bg-background">
        <TeacherHeader />
        
        <main className="flex-1 overflow-y-auto bg-background transition-colors duration-200" tabIndex={-1}>
          {/* Main Dashboard Container */}
          <div style={{ margin: "0 auto", maxWidth: 1400, padding: "24px 28px 80px 28px" }}>
            {children}
          </div>
        </main>
      </div>

      {/* Global Modals */}
      <GlobalSearchPalette />
      <NotificationDrawer />
    </div>
  );
}
