"use client";

import * as React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { useBuilderStore } from "@/stores/builder.store";

const STEPS = [
  { id: 1, title: "Course Information", description: "Basic details & branding" },
  { id: 2, title: "Curriculum Builder", description: "Sections & lessons" },
  { id: 3, title: "Resources", description: "Uploads & attachments" },
  { id: 4, title: "Live Classes", description: "Schedules & cohort sync" },
  { id: 5, title: "Pricing", description: "Monetization & access" },
  { id: 6, title: "SEO & Preview", description: "Review & publish" },
];

export function BuilderSidebar() {
  const currentStep = useBuilderStore((state) => state.currentStep);
  const setStep = useBuilderStore((state) => state.setStep);

  return (
    <aside
      style={{
        width: "288px",
        flexShrink: 0,
        borderRight: "1px solid hsl(var(--border))",
        background: "hsl(var(--border))",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflowY: "auto",
      }}
    >
      <div style={{ padding: "24px", borderBottom: "1px solid hsl(var(--border))" }}>
        <h2
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#6b7280",
            margin: 0,
          }}
        >
          Course Builder
        </h2>
        <p style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))", marginTop: "4px", margin: 0 }}>
          Complete all steps to publish
        </p>
      </div>

      <nav style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "4px" }}>
        {STEPS.map((step) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;

          return (
            <button
              key={step.id}
              onClick={() => setStep(step.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "12px",
                textAlign: "left",
                borderRadius: "10px",
                transition: "all 0.2s",
                position: "relative",
                background: isActive ? "rgba(124,58,237,0.12)" : "transparent",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              {isActive && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "12px",
                    bottom: "12px",
                    width: "4px",
                    background: "hsl(var(--primary))",
                    borderTopRightRadius: "9999px",
                    borderBottomRightRadius: "9999px",
                  }}
                />
              )}

              <div style={{ marginTop: "2px", flexShrink: 0 }}>
                {isCompleted ? (
                  <CheckCircle2 style={{ height: "20px", width: "20px", color: "#10b981" }} />
                ) : isActive ? (
                  <div
                    style={{
                      height: "20px",
                      width: "20px",
                      borderRadius: "50%",
                      border: "2px solid #7c3aed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div style={{ height: "8px", width: "8px", borderRadius: "50%", background: "hsl(var(--primary))" }} />
                  </div>
                ) : (
                  <Circle style={{ height: "20px", width: "20px", color: "rgba(156,163,175,0.5)" }} />
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: isActive ? 800 : 600,
                    color: isActive ? "hsl(var(--primary))" : "hsl(var(--foreground))",
                    transition: "color 0.2s",
                  }}
                >
                  Step {step.id}: {step.title}
                </span>
                <span style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))", marginTop: "2px" }}>
                  {step.description}
                </span>
              </div>
            </button>
          );
        })}
      </nav>

      <div style={{ padding: "24px", borderTop: "1px solid hsl(var(--border))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ flex: 1, height: "8px", background: "hsl(var(--border))", borderRadius: "9999px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                background: "hsl(var(--primary))",
                transition: "width 0.5s ease-in-out",
                width: `${(currentStep / 6) * 100}%`,
              }}
            />
          </div>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>
            {Math.round((currentStep / 6) * 100)}%
          </span>
        </div>
      </div>
    </aside>
  );
}
