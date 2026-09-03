import { Metadata } from "next";
import { CurriculumNavigator } from "@/features/student/components/workspace/curriculum/CurriculumNavigator";
import { WorkspaceRightSidebar } from "@/features/student/components/workspace/WorkspaceRightSidebar";

export const metadata: Metadata = {
  title: {
    default: "Learning Workspace",
    template: "%s | Speak Arena",
  },
};

export default function LearningWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/20">
      
      {/* Curriculum Sidebar (Left) */}
      <CurriculumNavigator />

      {/* Center Canvas */}
      <div className="flex-1 flex flex-col min-w-0 bg-secondary/5 relative">
        {children}
      </div>

      {/* Utility Panel (Right) */}
      <WorkspaceRightSidebar />
      
    </div>
  );
}
