import * as React from "react";
import { Metadata } from "next";
import { BuilderLayoutClient } from "@/features/teacher/components/builder/BuilderLayoutClient";

export const metadata: Metadata = {
  title: "Course Builder",
  description: "Create and edit your course curriculum.",
};

export default function CourseBuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BuilderLayoutClient>{children}</BuilderLayoutClient>;
}
