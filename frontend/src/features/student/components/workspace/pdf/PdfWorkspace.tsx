"use client";

import * as React from "react";
import { PdfToolbar } from "./PdfToolbar";
import { PdfLeftPanel } from "./PdfLeftPanel";
import { PdfRightPanel } from "./PdfRightPanel";
import { PdfViewerCore } from "./PdfViewerCore";

export function PdfWorkspace() {
  return (
    <div className="flex flex-col h-full w-full bg-background relative z-20">
      <PdfToolbar />
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <PdfLeftPanel />
        <PdfViewerCore />
        <PdfRightPanel />
      </div>
    </div>
  );
}
