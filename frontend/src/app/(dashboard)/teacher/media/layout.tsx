import * as React from "react";
import { Metadata } from "next";
import { MediaSidebar } from "@/features/teacher/components/media/MediaSidebar";

export const metadata: Metadata = {
  title: "Media Library",
  description: "Manage your enterprise course media assets.",
};

export default function MediaLibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full">
      <MediaSidebar />
      <div className="flex-1 overflow-x-hidden min-h-screen">
        {children}
      </div>
    </div>
  );
}
