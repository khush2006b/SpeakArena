"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Upload, Download, ChevronRight } from "lucide-react";

export function CourseHeader() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-6 sm:p-8 mb-8 hover-lift card-glass">
      <div className="grid-bg absolute inset-0 opacity-40 pointer-events-none" />
      <div 
        className="glow-purple absolute pointer-events-none" 
        style={{ width: 400, height: 400, top: -100, left: "50%", transform: "translateX(-50%)", background: "radial-gradient(circle, hsl(270 80% 60% / 0.15) 0%, transparent 70%)" }} 
      />
      
      <div className="relative z-10 flex flex-col gap-4 mb-8">
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4">
          <div>
            <nav className="flex items-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
              <Link 
                href="/teacher" 
                className="text-muted-foreground hover:text-foreground transition-colors no-underline"
              >
                Dashboard
              </Link>
              <ChevronRight className="mx-2 h-3 w-3 opacity-50" />
              <span className="text-[hsl(270,80%,60%)]" style={{ textShadow: "0 0 5px hsla(270,80%,60%,0.5)" }}>Courses</span>
            </nav>
            <h1 className="m-0 text-responsive-xl font-extrabold text-foreground tracking-tight">
              Course Management
            </h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-ghost press-scale h-10 px-4 inline-flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-muted-foreground text-sm font-semibold hover:text-foreground transition-all">
              <Upload className="mr-2 h-4 w-4 text-muted-foreground" />
              Import
            </button>
            <button className="btn-ghost press-scale h-10 px-4 inline-flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-muted-foreground text-sm font-semibold hover:text-foreground transition-all">
              <Download className="mr-2 h-4 w-4 text-muted-foreground" />
              Export
            </button>
            <Link 
              href="/teacher/builder"
              className="btn-primary press-scale h-10 px-[18px] inline-flex items-center justify-center rounded-lg bg-[hsl(270,80%,60%)] border-none text-white text-sm font-bold shadow-[0_0_20px_hsla(270,80%,60%,0.35)] transition-all no-underline"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Course
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
