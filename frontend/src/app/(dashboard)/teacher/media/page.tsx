import { Metadata } from "next";
import { MediaHeader } from "@/features/teacher/components/media/MediaHeader";
import { MediaStats } from "@/features/teacher/components/media/MediaStats";
import { MediaViewContainer } from "@/features/teacher/components/media/MediaViewContainer";
import { UploadQueueWidget } from "@/features/teacher/components/media/UploadQueueWidget";
import { MediaDetailsDrawer } from "@/features/teacher/components/media/MediaDetailsDrawer";

export const metadata: Metadata = {
  title: "Media Library",
  description: "Manage your enterprise course media assets.",
};

export default function MediaLibraryPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 pb-24 space-y-8">
      <MediaHeader />
      <MediaStats />
      <MediaViewContainer />

      <UploadQueueWidget />
      <MediaDetailsDrawer />
    </div>
  );
}
