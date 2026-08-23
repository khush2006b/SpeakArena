"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useBuilderStore } from "@/stores/builder.store";

import { InformationStep } from "./steps/InformationStep";
import { CurriculumStep } from "./steps/CurriculumStep";
import { ResourcesStep } from "./steps/ResourcesStep";
import { LiveClassesStep } from "./steps/LiveClassesStep";
import { PricingStep } from "./steps/PricingStep";
import { PreviewStep } from "./steps/PreviewStep";

export function BuilderWizard() {
  const currentStep = useBuilderStore((state) => state.currentStep);
  const loadCourse = useBuilderStore((state) => state.loadCourse);
  const searchParams = useSearchParams();
  const courseIdParam = searchParams.get("courseId");

  React.useEffect(() => {
    if (courseIdParam) {
      loadCourse(courseIdParam);
    }
  }, [courseIdParam, loadCourse]);

  const getStepComponent = () => {
    switch (currentStep) {
      case 1: return <InformationStep />;
      case 2: return <CurriculumStep />;
      case 3: return <ResourcesStep />;
      case 4: return <LiveClassesStep />;
      case 5: return <PricingStep />;
      case 6: return <PreviewStep />;
      default: return <InformationStep />;
    }
  };

  return (
    <div
      style={{
        position: "relative",
        minHeight: "600px",
        background: "hsl(var(--background))",
        padding: "24px",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{ width: "100%" }}
        >
          {getStepComponent()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
