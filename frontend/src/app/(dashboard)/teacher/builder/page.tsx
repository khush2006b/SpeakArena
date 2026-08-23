import { Suspense } from "react";
import { BuilderWizard } from "@/features/teacher/components/builder/BuilderWizard";
import { Loader2 } from "lucide-react";

export default function CourseBuilderPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 pb-24">
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <BuilderWizard />
      </Suspense>
    </div>
  );
}
