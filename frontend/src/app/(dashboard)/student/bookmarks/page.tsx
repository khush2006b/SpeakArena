import { Metadata } from "next";
import { StudentBookmarksView } from "@/features/student/components/bookmarks/StudentBookmarksView";

export const metadata: Metadata = {
  title: "Bookmarks",
  description: "Saved lesson timestamps and course notes.",
};

export default function StudentBookmarksPage() {
  return <StudentBookmarksView />;
}
