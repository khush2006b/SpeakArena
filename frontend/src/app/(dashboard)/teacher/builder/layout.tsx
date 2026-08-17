import * as React from "react";
import { Metadata } from "next";
import { BuilderSidebar } from "@/features/teacher/components/builder/BuilderSidebar";
import { BuilderHeader } from "@/features/teacher/components/builder/BuilderHeader";

export const metadata: Metadata = {
  title: "Course Builder",
  description: "Create and edit your course curriculum.",
};

export default function CourseBuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Fixed overlay covering the standard TeacherLayout to provide a full-screen Canva-like experience
    <div className="fixed inset-0 z-[100] bg-background flex h-screen w-screen overflow-hidden">
      <BuilderSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <BuilderHeader />
        <main className="flex-1 overflow-y-auto bg-secondary/10 relative">
          {children}
        </main>
      </div>
    </div>
  );
}
