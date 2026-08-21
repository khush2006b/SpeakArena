/**
 * Student portal layout — with StudentRoute guard.
 *
 * Implements the immersive, learning-first Netflix/Coursera style layout.
 * Wraps children in StudentRoute to enforce STUDENT role before rendering.
 */

import type { Metadata } from "next";
import { StudentSidebar } from "@/features/student/components/layout/StudentSidebar";
import { StudentHeader } from "@/features/student/components/layout/StudentHeader";
import { LearningProgressBar } from "@/features/student/components/layout/LearningProgressBar";
import { QuickActionBar } from "@/features/student/components/layout/QuickActionBar";
import { MobileBottomNav } from "@/features/student/components/layout/MobileBottomNav";
import { StudentRoute } from "@/components/guards/StudentRoute";

export const metadata: Metadata = {
  title: {
    default: "Student Dashboard",
    template: "%s | SpeakArena",
  },
};

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StudentRoute>
      <div className="flex min-h-screen w-full bg-background text-foreground transition-colors duration-200">
        
        {/* Top persistent progress tracking */}
        <LearningProgressBar />

        {/* Collapsible Immersive Sidebar */}
        <StudentSidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden transition-colors duration-200">
          
          {/* Sticky Header */}
          <StudentHeader />

          {/* Scrollable Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-7 pt-6 pb-20">
              {children}
            </div>
          </main>
        </div>

        {/* Floating Dynamic Island */}
        <QuickActionBar />
        
        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />
      </div>
    </StudentRoute>
  );
}
