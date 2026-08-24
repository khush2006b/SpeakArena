"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { TeacherSidebar } from "./TeacherSidebar";
import { TeacherHeader } from "./TeacherHeader";
import { GlobalSearchPalette } from "./GlobalSearchPalette";
import { NotificationDrawer } from "./NotificationDrawer";

export function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullBleedPage =
    pathname?.startsWith("/teacher/chat") ||
    pathname?.startsWith("/teacher/communication");

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground transition-colors duration-200">
      <TeacherSidebar />
      
      <div className="flex flex-1 flex-col overflow-hidden bg-background">
        <TeacherHeader />
        
        <main
          className={`flex-1 bg-background transition-colors duration-200 ${
            isFullBleedPage ? "overflow-hidden" : "overflow-y-auto"
          }`}
          tabIndex={-1}
        >
          {isFullBleedPage ? (
            <div className="w-full h-full">{children}</div>
          ) : (
            <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-7 pt-6 pb-20">
              {children}
            </div>
          )}
        </main>
      </div>

      {/* Global Modals */}
      <GlobalSearchPalette />
      <NotificationDrawer />
    </div>
  );
}
