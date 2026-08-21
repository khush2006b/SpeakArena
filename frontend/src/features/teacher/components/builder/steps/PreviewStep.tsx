"use client";

import * as React from "react";
import { CheckCircle2, Circle, Loader2, Rocket, Monitor, Smartphone, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBuilderStore } from "@/stores/builder.store";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function PreviewStep() {
  const {
    prevStep,
    courseTitle, description, price,
    publishCourse, isPublishing, error, reset,
  } = useBuilderStore();
  const router = useRouter();

  const hasTitle = Boolean(courseTitle.trim() && courseTitle !== "Untitled Course");
  const hasPrice = price >= 0;

  const handlePublish = async () => {
    const ok = await publishCourse();
    if (ok) {
      toast.success("🎉 Course published successfully and saved to database!");
      reset();
      router.push("/teacher/courses");
    } else {
      toast.error(error || "Failed to publish course.");
    }
  };

  const checks = [
    {
      done: hasTitle,
      label: "Course Information",
      desc: "Title and description filled out.",
    },
    {
      done: hasPrice,
      label: "Pricing Confirmed",
      desc: price === 0 ? "Free course." : `Base price: ₹${price.toFixed(2)}`,
    },
    {
      done: hasTitle && hasPrice,
      label: "Ready to Publish",
      desc: "Will save directly to database upon publishing.",
    },
  ];

  const allChecksPassed = checks.every((c) => c.done);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Review &amp; Publish</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Make sure everything looks perfect before adding your course to the database and publishing live.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium flex items-center justify-between">
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Publish Checklist */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Publish Checklist</h3>
          <div className="p-4 rounded-xl border border-border/50 bg-secondary/10 space-y-4">
            {checks.map(({ done, label, desc }) => (
              <div key={label} className="flex items-start gap-3">
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/50 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Course Summary */}
          {hasTitle && (
            <div className="p-4 rounded-xl border border-border/50 bg-card space-y-2 text-sm">
              <p className="font-semibold text-foreground truncate">{courseTitle}</p>
              {description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
              )}
              <p className="text-xs text-primary font-semibold">
                {price === 0 ? "Free" : `₹${price.toFixed(2)}`}
              </p>
            </div>
          )}
        </div>

        {/* Preview Tools */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Preview Tools</h3>
          <div className="grid gap-3">
            <Button
              variant="outline"
              className="justify-start h-12 press-scale"
              disabled={!hasTitle}
            >
              <Monitor className="h-4 w-4 mr-3 text-muted-foreground" />
              Desktop Preview (Student View)
            </Button>
            <Button
              variant="outline"
              className="justify-start h-12 press-scale"
              disabled={!hasTitle}
            >
              <Smartphone className="h-4 w-4 mr-3 text-muted-foreground" />
              Mobile Preview
            </Button>
            <Button
              variant="outline"
              className="justify-start h-12 press-scale"
              disabled={!hasTitle}
            >
              <Eye className="h-4 w-4 mr-3 text-muted-foreground" />
              SEO &amp; Social Card Preview
            </Button>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-border flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          ← Back to Pricing
        </Button>
        <Button
          onClick={handlePublish}
          disabled={!allChecksPassed || isPublishing}
          className="shadow-sm shadow-emerald-500/20 px-8 bg-emerald-600 hover:bg-emerald-700 text-white press-scale min-w-[160px]"
        >
          {isPublishing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Publishing to DB...
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4 mr-2" />
              Publish Course
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
